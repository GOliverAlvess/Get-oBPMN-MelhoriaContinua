import { doc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from '../firebase';
import { db } from '../firebase';
import { NotificationItem, Project, OperationalAction, Subtask } from '../types';

export async function createNotification(params: {
  usuario_id: string;
  tipo: 'card' | 'acao' | 'tarefa';
  mensagem: string;
  referencia_id: string;
  autor_id?: string;
  subtask_id?: string;
}) {
  const { usuario_id, tipo, mensagem, referencia_id, autor_id, subtask_id } = params;

  if (!usuario_id) return;

  // Anti-spam rule: Do not notify user of actions they executed for themselves
  if (autor_id && autor_id === usuario_id) return;

  try {
    const notifId = 'notif_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    const notification: NotificationItem = {
      id: notifId,
      usuario_id,
      tipo,
      mensagem,
      referencia_id,
      lida: false,
      data: new Date().toISOString(),
      autor_id,
      subtask_id,
    };

    // Save to Firestore 'notifications' collection
    await setDoc(doc(db, 'notifications', notifId), notification);
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
  }
}

export async function markAsRead(notificationId: string) {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { lida: true });
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
  }
}

export async function deleteNotification(notificationId: string) {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    console.error('Erro ao excluir notificação:', error);
  }
}

export async function markAllAsRead(notifications: NotificationItem[]) {
  try {
    const unread = notifications.filter((n) => !n.lida);
    for (const notif of unread) {
      await updateDoc(doc(db, 'notifications', notif.id), { lida: true });
    }
  } catch (error) {
    console.error('Erro ao marcar todas como lidas:', error);
  }
}

// Helpers for event-triggered notifications - STRICTLY ONLY ON CREATION / NEW ASSIGNMENT

export function notifyProjectChanges(
  oldProject: Project | null,
  newProject: Project,
  actorUserId?: string
) {
  const targetUserId = newProject.assignedTo;
  if (!targetUserId || targetUserId === 'backlog') return;

  // Anti-spam rule: Do not notify user of actions executed for themselves
  if (actorUserId && actorUserId === targetUserId) return;

  // Trigger ONLY on new card creation or reassignment to a new user
  if (!oldProject || oldProject.assignedTo !== targetUserId) {
    createNotification({
      usuario_id: targetUserId,
      tipo: 'card',
      mensagem: `Novo card atribuído a você: "${newProject.name}"`,
      referencia_id: newProject.id,
      autor_id: actorUserId,
    });
  }
}

export function notifyActionChanges(
  oldAction: OperationalAction | null,
  newAction: OperationalAction,
  actorUserId?: string
) {
  const targetUserId = newAction.responsibleId;
  if (!targetUserId) return;

  // Anti-spam rule: Do not notify user of actions executed for themselves
  if (actorUserId && actorUserId === targetUserId) return;

  // Trigger ONLY on new action creation or reassignment to a new user
  if (!oldAction || oldAction.responsibleId !== targetUserId) {
    createNotification({
      usuario_id: targetUserId,
      tipo: 'acao',
      mensagem: `Nova ação atribuída a você: "${newAction.action}" (${newAction.projectName || 'Projeto'})`,
      referencia_id: newAction.id,
      autor_id: actorUserId,
    });
  }
}

export function notifySubtaskChanges(
  projectId: string,
  projectName: string,
  oldSubtask: Subtask | null,
  newSubtask: Subtask,
  actorUserId?: string
) {
  const targetUserId = newSubtask.responsibleId;
  if (!targetUserId) return;

  // Anti-spam rule: Do not notify user of actions executed for themselves
  if (actorUserId && actorUserId === targetUserId) return;

  // Trigger ONLY on new subtask creation or reassignment
  if (!oldSubtask || oldSubtask.responsibleId !== targetUserId) {
    createNotification({
      usuario_id: targetUserId,
      tipo: 'tarefa',
      mensagem: `Nova atividade atribuída a você: "${newSubtask.title}" em ${projectName}`,
      referencia_id: projectId,
      subtask_id: newSubtask.id,
      autor_id: actorUserId,
    });
  }
}

