import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Calendar, 
  Users, 
  Briefcase, 
  Target,
  History,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { 
  db, 
  auth, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  setDoc, 
  doc, 
  handleFirestoreError, 
  OperationType 
} from '../firebase';
import { Project, User, OperationalAction, ReportLog } from '../types';
import { cn, exportarCSVPadrao } from '../lib/utils';
import FilterDropdown from './FilterDropdown';

const STATUS_MAP: Record<string, string> = {
  'pending': 'Pendente',
  'in_progress': 'Em andamento',
  'done': 'Concluído'
};

const translateStatus = (status: string) => STATUS_MAP[status] || status;

const HEADERS_PDCA = [
  "ID do Processo",
  "Nome do Problema",
  "Descrição do Problema",
  "PLAN - Causa Raiz",
  "PLAN - Impacto Descrição",
  "PLAN - Impacto Valor Atual",
  "PLAN - Meta (%)",
  "DO - Ação (What)",
  "DO - Responsável",
  "DO - Setor",
  "DO - Status",
  "DO - Data Início",
  "DO - Data Conclusão",
  "CHECK - Modo Acompanhamento",
  "CHECK - Período",
  "CHECK - Como Acompanha",
  "CHECK - Funcionou",
  "CHECK - Link evidência do acompanhamento",
  "CHECK - Impacto de ganho",
  "ACT - Status Final",
  "ACT - Ação Final",
  "ACT - Padronização"
];

const HEADERS_ACTIONS = [
  "Projeto",
  "Subtarefa",
  "Responsável",
  "Ação",
  "Prioridade",
  "Status",
  "Previsão",
  "Retorno da tratativa",
  "Data de conclusão"
];

interface ReportsTabProps {
  projects: Project[];
  users: User[];
  actions: OperationalAction[];
}

export default function ReportsTab({ projects, users, actions }: ReportsTabProps) {
  const [reportType, setReportType] = useState<'PDCA' | 'Histórico de Ações'>('PDCA');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [reportLogs, setReportLogs] = useState<ReportLog[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'reportLogs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReportLog));
      setReportLogs(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reportLogs');
    });
    return () => unsubscribe();
  }, []);

  const toggleFilter = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter(i => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const timestamp = new Date().toISOString();
      const user = auth.currentUser;
      
      if (!user) throw new Error('Usuário não autenticado');

      let data: any[] = [];
      let fileName = '';

      const filterByCommon = (itemDate: string, projectId: string, responsibleId: string, status: string) => {
        const dateMatch = (!startDate || !endDate) || isWithinInterval(parseISO(itemDate), {
          start: startOfDay(parseISO(startDate)),
          end: endOfDay(parseISO(endDate))
        });
        const projectMatch = selectedProjectIds.length === 0 || selectedProjectIds.includes(projectId);
        const collabMatch = selectedCollaborators.length === 0 || selectedCollaborators.includes(responsibleId);
        const statusMatch = selectedStatuses.length === 0 || selectedStatuses.includes(status);
        
        return dateMatch && projectMatch && collabMatch && statusMatch;
      };

      if (reportType === 'PDCA') {
        fileName = `Relatorio_PDCA_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        
        projects.forEach(project => {
          project.subtasks.forEach(subtask => {
            subtask.pdcaCycles.forEach(cycle => {
              const dateMatch = (!startDate || !endDate) || isWithinInterval(parseISO(cycle.createdAt), {
                start: startOfDay(parseISO(startDate)),
                end: endOfDay(parseISO(endDate))
              });
              const projectMatch = selectedProjectIds.length === 0 || selectedProjectIds.includes(project.id);
              
              if (dateMatch && projectMatch) {
                cycle.plan.actionPlan.forEach(action => {
                  const collabMatch = selectedCollaborators.length === 0 || selectedCollaborators.includes(action.who);
                  const statusMatch = selectedStatuses.length === 0 || selectedStatuses.includes(translateStatus(action.status));

                  if (collabMatch && statusMatch) {
                    data.push({
                      "ID do Processo": subtask.id,
                      "Nome do Problema": cycle.title,
                      "Descrição do Problema": cycle.plan.problemDescription,
                      "PLAN - Causa Raiz": cycle.plan.rootCauseAnalysis.identifiedRootCause || 'N/A',
                      "PLAN - Impacto Descrição": cycle.plan.impact.description,
                      "PLAN - Impacto Valor Atual": cycle.plan.impact.value,
                      "PLAN - Meta (%)": cycle.plan.impact.goal,
                      "DO - Ação (What)": action.what,
                      "DO - Responsável": users.find(u => u.id === action.who)?.name || action.who,
                      "DO - Setor": action.sector || 'N/A',
                      "DO - Status": translateStatus(action.status),
                      "DO - Data Início": action.startDate || 'N/A',
                      "DO - Data Conclusão": action.endDate || 'N/A',
                      "CHECK - Modo Acompanhamento": action.monitoringMode || 'N/A',
                      "CHECK - Período": action.monitoringPeriod || 'N/A',
                      "CHECK - Como Acompanha": action.monitoringTool || 'N/A',
                      "CHECK - Funcionou": action.worked || 'N/A',
                      "CHECK - Link evidência do acompanhamento": action.evidence || 'N/A',
                      "CHECK - Impacto de ganho": action.gainImpact || 'N/A',
                      "ACT - Status Final": action.finalProblemStatus || 'N/A',
                      "ACT - Ação Final": action.finalAction || 'N/A',
                      "ACT - Padronização": action.standardizationModels?.join(', ') || 'N/A'
                    });
                  }
                });
              }
            });
          });
        });
      } else {
        fileName = `Historico_Acoes_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
        
        actions.forEach(action => {
          if (filterByCommon(action.createdAt, action.projectId, action.responsibleId, translateStatus(action.status))) {
            data.push({
              "Projeto": action.projectName,
              "Subtarefa": action.subtaskTitle,
              "Responsável": action.responsibleName,
              "Ação": action.action,
              "Prioridade": action.priority,
              "Status": translateStatus(action.status),
              "Previsão": action.forecastDate,
              "Retorno da tratativa": action.feedback || 'N/A',
              "Data de conclusão": action.completionDate || 'N/A'
            });
          }
        });
      }

      if (data.length === 0) {
        alert('Nenhum dado encontrado para os filtros selecionados.');
        return;
      }

      const headers = reportType === 'PDCA' ? HEADERS_PDCA : HEADERS_ACTIONS;
      const csvRows = data.map(item => headers.map(header => item[header] || ''));

      exportarCSVPadrao(headers, csvRows, fileName);

      // Log the generation
      const logId = uuidv4();
      const log: ReportLog = {
        id: logId,
        userId: user.uid,
        userName: user.displayName || user.email || 'Usuário',
        timestamp,
        reportType
      };

      await setDoc(doc(db, 'reportLogs', logId), log);

    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório. Verifique os logs do console.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-12 w-full">
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Gerador de Relatórios</h3>
          <p className="text-slate-500 text-sm mt-1">Selecione os filtros e gere relatórios em formato Excel.</p>
        </div>

        <div className="bg-slate-50/50 p-6 lg:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tipo de Relatório */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">1. Tipo de Relatório</label>
              <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm h-[52px]">
                <button 
                  onClick={() => setReportType('PDCA')}
                  className={cn(
                    "flex-1 rounded-xl text-xs font-bold transition-all",
                    reportType === 'PDCA' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  PDCA
                </button>
                <button 
                  onClick={() => setReportType('Histórico de Ações')}
                  className={cn(
                    "flex-1 rounded-xl text-xs font-bold transition-all",
                    reportType === 'Histórico de Ações' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
                  )}
                >
                  Histórico de Ações
                </button>
              </div>
            </div>

            {/* Período */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">2. Período de Análise</label>
              <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-3">
                <div className="relative">
                  <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
                  />
                </div>
                <span className="text-slate-300 font-bold text-[10px] uppercase">até</span>
                <div className="relative">
                  <Calendar size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Projetos */}
            <div className="space-y-3">
              <FilterDropdown
                label="3. Projetos"
                placeholder="Todos os projetos"
                options={projects.map(p => ({ id: p.id, label: p.name }))}
                selected={selectedProjectIds}
                onToggle={(id) => toggleFilter(selectedProjectIds, id, setSelectedProjectIds)}
                onClear={() => setSelectedProjectIds([])}
                icon={<Briefcase size={16} />}
                showSearch
              />
            </div>

            {/* Colaboradores */}
            <div className="space-y-3">
              <FilterDropdown
                label="4. Colaboradores"
                placeholder="Todos os colaboradores"
                options={users.map(u => ({ id: u.id, label: u.name }))}
                selected={selectedCollaborators}
                onToggle={(id) => toggleFilter(selectedCollaborators, id, setSelectedCollaborators)}
                onClear={() => setSelectedCollaborators([])}
                icon={<Users size={16} />}
                showSearch
              />
            </div>

            {/* Status */}
            <div className="space-y-3 md:col-span-2">
              <FilterDropdown
                label="5. Status das Ações"
                placeholder="Todos os status"
                options={['Pendente', 'Em andamento', 'Concluído'].map(s => ({ id: s, label: s }))}
                selected={selectedStatuses}
                onToggle={(id) => toggleFilter(selectedStatuses, id, setSelectedStatuses)}
                onClear={() => setSelectedStatuses([])}
                icon={<Target size={16} />}
              />
            </div>
          </div>

          <div className="pt-8 flex justify-end border-t border-slate-100">
            <button 
              onClick={generateReport}
              disabled={isGenerating}
              className={cn(
                "group relative bg-indigo-600 text-white min-w-[200px] h-[58px] rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
                isGenerating && "animate-pulse"
              )}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  <span>Gerando...</span>
                </>
              ) : (
                <>
                  <Download size={20} className="group-hover:-translate-y-0.5 transition-transform" />
                  <span>Gerar Relatório</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <History size={18} className="text-slate-400" />
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Histórico de Relatórios Gerados</h4>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuário</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data e Hora</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Relatório</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500">
                          <UserIcon size={14} />
                        </div>
                        <span className="text-sm font-bold text-slate-700">{log.userName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-500 font-medium">
                        {format(parseISO(log.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                        log.reportType === 'PDCA' ? "bg-indigo-100 text-indigo-600" : "bg-emerald-100 text-emerald-600"
                      )}>
                        {log.reportType}
                      </span>
                    </td>
                  </tr>
                ))}
                {reportLogs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <FileText size={32} className="opacity-20" />
                        <p className="text-sm italic">Nenhum relatório gerado ainda.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function RefreshCw({ className, size }: { className?: string, size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
