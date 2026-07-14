import type { RealtimeChannel } from '@supabase/supabase-js';
import type { MarketingTemplate, Task } from '../types';
import type { Json } from './database.types';
import { supabase } from './cloudMemory';

export type TeamRole = 'owner' | 'editor' | 'viewer';

export interface CollaborationTeam {
  id: string;
  name: string;
  ownerId: string;
  currentUserRole: TeamRole;
  members: CollaborationMember[];
}

export interface CollaborationMember {
  userId: string;
  email: string;
  displayName: string;
  role: TeamRole;
}

export interface SharedPlan {
  id: string;
  teamId: string;
  ownerId: string;
  sourcePlanId: string;
  title: string;
  template: MarketingTemplate;
  tasks: Task[];
  archived: boolean;
  updatedAt: string;
}

const asRole = (value: string): TeamRole =>
  value === 'owner' || value === 'viewer' ? value : 'editor';

export const loadCollaboration = async (): Promise<{
  teams: CollaborationTeam[];
  sharedPlans: SharedPlan[];
}> => {
  const [{ data: teamRows, error: teamsError }, { data: memberRows, error: membersError }, { data: planRows, error: plansError }] = await Promise.all([
    supabase.from('teams').select('id, name, owner_id').order('created_at'),
    supabase.from('team_members').select('team_id, user_id, email, display_name, role').order('created_at'),
    supabase.from('shared_plans').select('*').order('updated_at', { ascending: false }),
  ]);

  if (teamsError) throw teamsError;
  if (membersError) throw membersError;
  if (plansError) throw plansError;

  const { data: { user } } = await supabase.auth.getUser();
  const teams = (teamRows ?? []).map(team => {
    const members: CollaborationMember[] = (memberRows ?? [])
      .filter(member => member.team_id === team.id)
      .map(member => ({
        userId: member.user_id,
        email: member.email,
        displayName: member.display_name || member.email.split('@')[0],
        role: asRole(member.role),
      }));
    return {
      id: team.id,
      name: team.name,
      ownerId: team.owner_id,
      currentUserRole: members.find(member => member.userId === user?.id)?.role ?? 'viewer',
      members,
    };
  });

  const sharedPlans: SharedPlan[] = (planRows ?? []).map(plan => ({
    id: plan.id,
    teamId: plan.team_id,
    ownerId: plan.owner_id,
    sourcePlanId: plan.source_plan_id,
    title: plan.title,
    template: plan.template as unknown as MarketingTemplate,
    tasks: plan.tasks as unknown as Task[],
    archived: plan.archived,
    updatedAt: plan.updated_at,
  }));

  return { teams, sharedPlans };
};

export const createCollaborationTeam = async (name: string): Promise<string> => {
  const { data, error } = await supabase.rpc('create_team', { team_name: name.trim() });
  if (error) throw error;
  return data;
};

export const addCollaborationMember = async (
  teamId: string,
  email: string,
  role: Exclude<TeamRole, 'owner'>,
): Promise<void> => {
  const { error } = await supabase.rpc('add_team_member_by_email', {
    target_team_id: teamId,
    target_email: email.trim().toLowerCase(),
    target_role: role,
  });
  if (error) throw error;
};

export const removeCollaborationMember = async (teamId: string, userId: string): Promise<void> => {
  const { error } = await supabase.rpc('remove_team_member', {
    target_team_id: teamId,
    target_user_id: userId,
  });
  if (error) throw error;
};

export const sharePlanWithTeam = async ({
  teamId,
  ownerId,
  sourcePlanId,
  title,
  template,
  tasks,
}: {
  teamId: string;
  ownerId: string;
  sourcePlanId: string;
  title: string;
  template: MarketingTemplate;
  tasks: Task[];
}): Promise<void> => {
  const { error } = await supabase.from('shared_plans').upsert({
    team_id: teamId,
    owner_id: ownerId,
    source_plan_id: sourcePlanId,
    title,
    template: template as unknown as Json,
    tasks: tasks as unknown as Json,
    last_edited_by: ownerId,
  }, { onConflict: 'team_id,owner_id,source_plan_id' });
  if (error) throw error;
};

export const updateSharedPlan = async (
  sharedPlanId: string,
  title: string,
  template: MarketingTemplate,
  tasks: Task[],
): Promise<void> => {
  const { error } = await supabase.from('shared_plans').update({
    title,
    template: template as unknown as Json,
    tasks: tasks as unknown as Json,
  }).eq('id', sharedPlanId);
  if (error) throw error;
};

export const stopSharingPlan = async (sharedPlanId: string): Promise<void> => {
  const { error } = await supabase.from('shared_plans').delete().eq('id', sharedPlanId);
  if (error) throw error;
};

export const subscribeToSharedPlans = (onChange: () => void): RealtimeChannel =>
  supabase
    .channel(`shared-plans-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_plans' }, onChange)
    .subscribe();
