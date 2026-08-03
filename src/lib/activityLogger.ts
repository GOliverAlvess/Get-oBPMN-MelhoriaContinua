import { db, setDoc, doc, updateDoc, getDoc } from '../firebase';
import { UserActivityLog, User } from '../types';

/**
 * Whitelist de ações relevantes que representam interações e alterações reais de dados.
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
 * e atualiza estatísticas no registro do usuário em 'users'.
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
    // 1. Grava o log individual de atividade
    await setDoc(doc(db, 'userActivityLogs', logId), logData);

    // 2. Atualiza os contadores no cadastro do usuário
    const userRef = doc(db, 'users', params.userId);
    const userSnap = await getDoc(userRef);

    const isLogin = params.actionType === 'login';

    if (userSnap.exists()) {
      const userData = userSnap.data() as User;
      const currentLogins = userData.loginCount || 0;
      const currentActions = userData.actionCount || 0;
      const currentUsageMinutes = userData.totalUsageMinutes || 0;

      // Estimativa: 5 minutos por login, 2 minutos por ação relevante efetuada
      const usageIncrement = isLogin ? 5 : 2;

      await updateDoc(userRef, {
        lastAccess: timestamp,
        loginCount: isLogin ? currentLogins + 1 : currentLogins,
        // Incrementa o contador de ações apenas para ações reais (não login)
        actionCount: isLogin ? currentActions : currentActions + 1,
        totalUsageMinutes: currentUsageMinutes + usageIncrement,
        status: 'Ativo',
      });
    } else {
      await setDoc(userRef, {
        id: params.userId,
        name: params.userName,
        email: params.userEmail,
        lastAccess: timestamp,
        loginCount: isLogin ? 1 : 0,
        actionCount: isLogin ? 0 : 1,
        totalUsageMinutes: isLogin ? 5 : 2,
        status: 'Ativo',
      }, { merge: true });
    }
  } catch (err) {
    console.warn('Erro ao salvar log de atividade de usuário:', err);
  }
}

