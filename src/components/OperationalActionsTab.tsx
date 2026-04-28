import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  ChevronDown, 
  X, 
  Download,
  History,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreVertical,
  Save,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Project, User, OperationalAction, ProjectPriority } from '../types';
import { cn, exportarCSVPadrao, cleanObject } from '../lib/utils';
import { db, setDoc, doc, deleteDoc, handleFirestoreError, OperationType } from '../firebase';

interface OperationalActionsTabProps {
  actions: OperationalAction[];
  projects: Project[];
  users: User[];
  key?: string;
}

export default function OperationalActionsTab({ actions, projects, users }: OperationalActionsTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionToDelete, setActionToDelete] = useState<OperationalAction | null>(null);
  const [showBlockedMessage, setShowBlockedMessage] = useState(false);
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterResponsible, setFilterResponsible] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [tempUpdates, setTempUpdates] = useState<Partial<OperationalAction>>({});
  const [actionToSave, setActionToSave] = useState<OperationalAction | null>(null);
  const [updatesToSave, setUpdatesToSave] = useState<Partial<OperationalAction>>({});

  const filteredActions = useMemo(() => {
    return actions.filter(a => {
      const matchesSearch = a.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          a.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          a.subtaskTitle.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProject = !filterProject || a.projectId === filterProject;
      const matchesResponsible = !filterResponsible || a.responsibleId === filterResponsible;
      const matchesStatus = !filterStatus || a.status === filterStatus;
      const matchesPriority = !filterPriority || a.priority === filterPriority;
      
      return matchesSearch && matchesProject && matchesResponsible && matchesStatus && matchesPriority;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [actions, searchTerm, filterProject, filterResponsible, filterStatus, filterPriority]);

  const handleUpdateAction = async (id: string, updates: Partial<OperationalAction>) => {
    try {
      const actionRef = doc(db, 'operationalActions', id);
      const action = actions.find(a => a.id === id);
      if (action) {
        const finalAction = cleanObject({ ...action, ...updates });
        await setDoc(actionRef, finalAction);
        setEditingActionId(null);
        setTempUpdates({});
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `operationalActions/${id}`);
    }
  };

  const handleConfirmSave = (id: string, updates: Partial<OperationalAction>) => {
    const action = actions.find(a => a.id === id);
    if (action) {
      setActionToSave(action);
      setUpdatesToSave(updates);
    }
  };

  const onConfirmSave = async () => {
    if (!actionToSave) return;
    await handleUpdateAction(actionToSave.id, updatesToSave);
    setActionToSave(null);
    setUpdatesToSave({});
  };

  const startEditing = (action: OperationalAction) => {
    if (action.status === 'Concluído') {
      alert('Ações concluídas não podem ser editadas.');
      return;
    }
    setEditingActionId(action.id);
    setTempUpdates({
      status: action.status,
      feedback: action.feedback || '',
      completionDate: action.completionDate || ''
    });
  };

  const handleConfirmDelete = async () => {
    if (!actionToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'operationalActions', actionToDelete.id));
      setActionToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `operationalActions/${actionToDelete.id}`);
    }
  };

  const handleDeleteClick = (action: OperationalAction) => {
    if (action.status === 'Concluído') {
      setShowBlockedMessage(true);
      setTimeout(() => setShowBlockedMessage(false), 3000);
      return;
    }
    setActionToDelete(action);
  };

  const exportToCSV = () => {
    const headers = ['Projeto', 'Subtarefa', 'Responsável', 'Ação', 'Prioridade', 'Status', 'Previsão', 'Conclusão', 'Retorno'];
    const rows = filteredActions.map(a => [
      a.projectName,
      a.subtaskTitle,
      a.responsibleName,
      a.action,
      a.priority,
      a.status,
      a.forecastDate,
      a.completionDate || '',
      a.feedback || ''
    ]);

    const fileName = `historico_acoes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    exportarCSVPadrao(headers, rows, fileName);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Histórico de Ações</h2>
          <p className="text-slate-500 mt-1">Gestão de tratativas e ações operacionais do setor.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={18} />
            Exportar CSV
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus size={18} />
            Nova Ação
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <Filter size={16} />
          <span className="text-xs font-black uppercase tracking-widest">Filtros de Busca</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 min-w-0">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Buscar ação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
          
          <select 
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="">Todos os Projetos</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <select 
            value={filterResponsible}
            onChange={(e) => setFilterResponsible(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="">Todos os Responsáveis</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="">Todos os Status</option>
            <option value="Pendente">Pendente</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Concluído">Concluído</option>
          </select>

          <select 
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="">Todas as Prioridades</option>
            <option value="Baixa">Baixa</option>
            <option value="Média">Média</option>
            <option value="Alta">Alta</option>
          </select>
        </div>
      </div>

      {/* Listagem */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-separate border-spacing-0 min-w-[1600px]">
            <thead>
              <tr className="bg-[#003489]">
                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[200px]">Projeto</th>
                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[180px]">Subtarefa</th>
                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[180px]">Responsável</th>
                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[350px]">Ação</th>
                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[120px]">Prioridade</th>
                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[160px]">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[120px]">Previsão</th>
                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[300px]">Retorno da Tratativa</th>
                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest min-w-[160px]">Data de Conclusão</th>
                <th className="px-6 py-4 text-[10px] font-black text-white uppercase tracking-widest w-32 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredActions.map((action) => {
                const isEditing = editingActionId === action.id;
                const currentStatus = isEditing ? (tempUpdates.status || action.status) : action.status;
                const currentFeedback = isEditing ? (tempUpdates.feedback || action.feedback) : action.feedback;
                const currentCompletionDate = isEditing ? (tempUpdates.completionDate || action.completionDate) : action.completionDate;

                return (
                  <tr key={action.id} className={cn(
                    "group transition-all duration-300",
                    isEditing ? "bg-indigo-50" : "hover:bg-slate-50/50"
                  )}>
                    <td className={cn(
                      "px-6 py-4 min-w-0 transition-all",
                      isEditing && "border-l-4 border-[#003489]"
                    )}>
                      <span className="font-bold text-slate-700 text-[13px] break-words line-clamp-2" title={action.projectName}>{action.projectName}</span>
                    </td>
                    <td className="px-6 py-4 min-w-0">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider break-words line-clamp-2" title={action.subtaskTitle}>{action.subtaskTitle}</span>
                    </td>
                    <td className="px-6 py-4 min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black shrink-0">
                          {action.responsibleName.charAt(0)}
                        </div>
                        <span className="text-[13px] font-bold text-slate-600 truncate">{action.responsibleName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
                        <p className="text-[13px] text-slate-600 leading-relaxed min-h-[40px]">{action.action}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider inline-block",
                        action.priority === 'Alta' ? "bg-rose-100 text-rose-600" :
                        action.priority === 'Média' ? "bg-indigo-100 text-indigo-600" :
                        "bg-slate-200 text-slate-600"
                      )}>
                        {action.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        disabled={!isEditing}
                        value={currentStatus}
                        onChange={(e) => setTempUpdates(prev => ({ ...prev, status: e.target.value as any }))}
                        className={cn(
                          "w-full px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider outline-none border border-transparent focus:border-indigo-300 disabled:cursor-not-allowed transition-all",
                          currentStatus === 'Concluído' ? "bg-emerald-50 text-emerald-600" :
                          currentStatus === 'Em andamento' ? "bg-amber-50 text-amber-600" :
                          "bg-slate-100 text-slate-500"
                        )}
                      >
                        <option value="Pendente">Pendente</option>
                        <option value="Em andamento">Em andamento</option>
                        <option value="Concluído">Concluído</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500 whitespace-nowrap">
                        <Clock size={14} className="text-slate-400" />
                        <span className="text-[11px] font-bold">
                          {format(new Date(action.forecastDate), 'dd/MM/yyyy')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <textarea 
                        disabled={!isEditing}
                        value={currentFeedback || ''}
                        onChange={(e) => setTempUpdates(prev => ({ ...prev, feedback: e.target.value }))}
                        placeholder="Descreva o retorno da tratativa..."
                        className="w-full bg-slate-50/50 p-3 rounded-xl text-[13px] text-slate-600 outline-none border border-slate-100 focus:border-indigo-300 focus:bg-white transition-all resize-none min-h-[80px] leading-relaxed disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative">
                        <input 
                          disabled={!isEditing}
                          type="date"
                          value={currentCompletionDate || ''}
                          onChange={(e) => setTempUpdates(prev => ({ ...prev, completionDate: e.target.value }))}
                          className="w-full bg-slate-50/50 px-3 py-2 rounded-xl text-[13px] font-bold text-slate-500 outline-none border border-slate-100 focus:border-indigo-300 focus:bg-white transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button 
                              onClick={() => handleConfirmSave(action.id, tempUpdates)}
                              className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all shadow-sm border border-emerald-100"
                              title="Salvar"
                            >
                              <Save size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingActionId(null);
                                setTempUpdates({});
                              }}
                              className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-rose-100"
                              title="Cancelar"
                            >
                              <X size={18} />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => startEditing(action)}
                            disabled={action.status === 'Concluído'}
                            className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-indigo-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:hover:border-transparent"
                            title="Editar"
                          >
                            <MoreVertical size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteClick(action)}
                          className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-rose-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredActions.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200">
                        <History size={32} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-500">Nenhuma ação encontrada</p>
                        <p className="text-xs text-slate-400 mt-1">Tente ajustar os filtros ou crie uma nova ação.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateActionModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projects={projects}
        users={users}
      />

      {/* Alerta de Ação Bloqueada */}
      <AnimatePresence>
        {showBlockedMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 right-8 z-[200] bg-rose-600 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 font-bold border border-rose-500"
          >
            <AlertCircle size={20} />
            <span>Ações concluídas não podem ser excluídas.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Exclusão */}
      <AnimatePresence>
        {actionToDelete && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActionToDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Confirmar Exclusão</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                Tem certeza que deseja excluir esta ação? Esta operação não poderá ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setActionToDelete(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Não, voltar
                </button>
                <button 
                  onClick={handleConfirmDelete}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
                >
                  Sim, excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Confirmação de Salvamento */}
      <AnimatePresence>
        {actionToSave && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActionToSave(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Save size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Salvar Alterações</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                Deseja realmente salvar as alterações feitas nesta ação?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setActionToSave(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={onConfirmSave}
                  className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateActionModal({ isOpen, onClose, projects, users }: { isOpen: boolean, onClose: () => void, projects: Project[], users: User[] }) {
  const [projectId, setProjectId] = useState('');
  const [subtaskId, setSubtaskId] = useState('');
  const [action, setAction] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('Média');
  const [forecastDate, setForecastDate] = useState(new Date().toISOString().split('T')[0]);

  const selectedProject = projects.find(p => p.id === projectId);
  const subtasks = selectedProject?.subtasks || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !subtaskId || !action || !responsibleId) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const selectedSubtask = subtasks.find(s => s.id === subtaskId);
    const selectedResponsible = users.find(u => u.id === responsibleId);

    const newAction: OperationalAction = {
      id: uuidv4(),
      projectId,
      projectName: selectedProject?.name || '',
      subtaskId,
      subtaskTitle: selectedSubtask?.title || '',
      action,
      responsibleId,
      responsibleName: selectedResponsible?.name || '',
      priority,
      status: 'Pendente',
      forecastDate,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'operationalActions', newAction.id), newAction);
      onClose();
      // Reset form
      setProjectId('');
      setSubtaskId('');
      setAction('');
      setResponsibleId('');
      setPriority('Média');
      setForecastDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `operationalActions/${newAction.id}`);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                  <Plus size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Nova Ação Operacional</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Registro de Tratativa</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-all text-slate-400 hover:text-slate-600 shadow-sm border border-transparent hover:border-slate-100">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Projeto</label>
                  <select 
                    required
                    value={projectId}
                    onChange={(e) => {
                      setProjectId(e.target.value);
                      setSubtaskId('');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                  >
                    <option value="">Selecionar Projeto</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Subtarefa</label>
                  <select 
                    required
                    disabled={!projectId}
                    value={subtaskId}
                    onChange={(e) => setSubtaskId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium disabled:opacity-50"
                  >
                    <option value="">Selecionar Subtarefa</option>
                    {subtasks.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Ação a ser realizada</label>
                <textarea 
                  required
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  placeholder="Descreva detalhadamente a ação..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Responsável</label>
                  <select 
                    required
                    value={responsibleId}
                    onChange={(e) => setResponsibleId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                  >
                    <option value="">Selecionar Responsável</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Prioridade</label>
                  <select 
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Previsão de Conclusão</label>
                <input 
                  type="date"
                  required
                  value={forecastDate}
                  onChange={(e) => setForecastDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Criar Ação
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
