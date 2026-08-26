import { db, setDoc, doc, atomicUpdateUserActivity } from '../firebase';
import { UserActivityLog, User, UserDailyActivity } from '../types';
import { getTodayDateString } from './userActivityTracker';

/**
 * Whitelist de ações relevantes que representam operações e alterações reais de dados.
 * Ações passivas (como navegação, visualizações ou abertura de modais sem alteração)
 * são desconsideradas para garantir a confiabilidade da auditoria.
 */
export const RELEVANT_ACTION_TYPES: ReadonlyArray<UserActivityLog['actionType']> = [
  'login',
  'project_create',
  'project_update',
  'project_move',
  'subtask_update',
  'pdca_update',
  'operational_action',
  'file_upload',
  'report_download',
  'settings_change'
];

/**
 * Registra uma ação relevante de atividade de usuário na coleção 'userActivityLogs'
 * e atualiza estatísticas e data de última atividade real.
 */
export async function logUserActivity(params: {
  userId: string;
  userName: string;
  userEmail?: string;
  actionType: UserActivityLog['actionType'];
  actionName: string;
  details?: string;
  entityId?: string;
  entityName?: string;
}) {
  if (!params.userId) return;

  // Filtra apenas eventos presentes na whitelist de ações relevantes
  if (!RELEVANT_ACTION_TYPES.includes(params.actionType)) {
    return;
  }

  const timestamp = new Date().toISOString();
  const todayStr = getTodayDateString();
  const logId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const logData: UserActivityLog = {
    id: logId,
    userId: params.userId,
    userName: params.userName || 'Usuário',
    userEmail: params.userEmail || '',
    actionType: params.actionType,
    actionName: params.actionName,
    details: params.details || '',
    entityId: params.entityId || '',
    entityName: params.entityName || '',
    timestamp,
  };

  try {
    // 1. Grava o log individual de atividade para auditoria
    await setDoc(doc(db, 'userActivityLogs', logId), logData);

    const isLogin = params.actionType === 'login';

    // 2. Atualiza atomicamente a coleção diária 'userDailyActivity' e os contadores de 'users' (AUD-001)
    await atomicUpdateUserActivity({
      userId: params.userId,
      userName: params.userName || 'Usuário',
      userEmail: params.userEmail || '',
      date: todayStr,
      dailyInc: isLogin ? { sessionsCount: 1 } : { actionsCount: 1 },
      dailySet: {
        lastActiveAt: timestamp,
      },
      userInc: isLogin ? { loginCount: 1 } : { actionCount: 1 },
      userSet: {
        name: params.userName,
        email: params.userEmail || '',
        lastActiveAt: timestamp,
        status: 'Ativo',
        ...(isLogin ? { lastAccess: timestamp, lastLoginAt: timestamp } : {}),
      },
    });
  } catch (err) {
    console.warn('Erro ao salvar log de atividade de usuário:', err);
  }
}

