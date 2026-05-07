import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Users, 
  Filter,
  CheckCircle2,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { InnovationProject, User } from '../types';
import { cn } from '../lib/utils';
import { auth, db, doc, setDoc } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

// Set up pdfMake fonts
if (pdfFonts && (pdfFonts as any).pdfMake) {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
} else if ((pdfFonts as any).vfs) {
  (pdfMake as any).vfs = (pdfFonts as any).vfs;
}

const INNOVATION_TYPES = ['Incremental', 'Radical', 'Disruptiva', 'Arquitetural'];
const STATUS_LABELS: Record<string, string> = {
  'backlog': 'Backlog',
  'análise': 'Análise',
  'planejamento': 'Planejamento',
  'desenvolvimento': 'Desenvolvimento',
  'teste': 'Teste',
  'concluído': 'Concluído'
};

interface InnovationReportsTabProps {
  projects: InnovationProject[];
  users: User[];
}

export default function InnovationReportsTab({ projects, users }: InnovationReportsTabProps) {
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedResponsibles, setSelectedResponsibles] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => !p.deleted).filter(p => {
      const projectMatch = selectedProjectIds.length === 0 || selectedProjectIds.includes(p.id);
      const responsibleMatch = selectedResponsibles.length === 0 || selectedResponsibles.includes(p.responsibleId);
      
      return projectMatch && responsibleMatch;
    });
  }, [projects, selectedProjectIds, selectedResponsibles]);

  const generateExcel = () => {
    if (filteredProjects.length === 0) {
      alert('Nenhum projeto encontrado para os filtros selecionados.');
      return;
    }

    const data = filteredProjects.map(p => ({
      'Nome do Projeto': p.title,
      'Descrição': p.description || '',
      'Responsável': p.responsibleName || 'Não atribuído',
      'Área / Setor': p.sector || '',
      'Status': STATUS_LABELS[p.status] || p.status,
      'Tipo de Inovação': p.innovationType || '',
      'Ganho Estimado (R$)': p.estimatedGain || 0,
      'Ganho Real (R$)': p.realGain || 0,
      'Data de Criação': format(parseISO(p.createdAt), 'dd/MM/yyyy'),
      'Data de Conclusão': p.completionDate ? format(parseISO(p.completionDate), 'dd/MM/yyyy') : '',
      'Etapa Atual': STATUS_LABELS[p.status] || p.status,
      'Solução': p.type || '',
      'Complexidade': p.complexity || '',
      'Progresso (%)': p.progress || 0
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inovações");
    
    // Auto-size columns
    const maxWidths = Object.keys(data[0] || {}).map(key => {
      return Math.max(key.length, ...data.map(row => String((row as any)[key]).length));
    });
    ws['!cols'] = maxWidths.map(w => ({ wch: w + 2 }));

    XLSX.writeFile(wb, `Relatorio_Inovacoes_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    logReport('Excel');
  };

  const generatePDF = () => {
    if (filteredProjects.length === 0) {
      alert('Nenhum projeto encontrado para os filtros selecionados.');
      return;
    }

    const docDefinition: any = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [40, 40, 40, 40],
      content: [
        { text: 'RELATÓRIO DE PROJETOS DE INOVAÇÃO', style: 'header' },
        { text: `Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, style: 'subheader' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'PROJETO', style: 'tableHeader' },
                { text: 'SETOR', style: 'tableHeader' },
                { text: 'RESP.', style: 'tableHeader' },
                { text: 'STATUS', style: 'tableHeader' },
                { text: 'TIPO', style: 'tableHeader' },
                { text: 'EST. (R$)', style: 'tableHeader' },
                { text: 'REAL (R$)', style: 'tableHeader' }
              ],
              ...filteredProjects.map(p => [
                { text: p.title, style: 'tableCell' },
                { text: p.sector || '', style: 'tableCell' },
                { text: p.responsibleName || '', style: 'tableCell' },
                { text: STATUS_LABELS[p.status] || p.status, style: 'tableCell' },
                { text: p.innovationType || '', style: 'tableCell' },
                { text: p.estimatedGain ? p.estimatedGain.toLocaleString() : '---', style: 'tableCell' },
                { text: p.realGain ? p.realGain.toLocaleString() : '---', style: 'tableCell' }
              ])
            ]
          },
          layout: 'lightHorizontalLines'
        }
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10], color: '#003489' },
        subheader: { fontSize: 10, italic: true, margin: [0, 0, 0, 20], color: '#64748b' },
        tableHeader: { fontSize: 10, bold: true, fillColor: '#f1f5f9', margin: [0, 5, 0, 5] },
        tableCell: { fontSize: 9, margin: [0, 5, 0, 5] },
        tableCellDescription: { fontSize: 8, margin: [0, 5, 0, 5] }
      },
      defaultStyle: { font: 'Roboto' }
    };

    pdfMake.createPdf(docDefinition).download(`Relatorio_Inovacoes_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    logReport('PDF');
  };

  const logReport = async (type: string) => {
    const user = auth.currentUser;
    if (user) {
      const logId = uuidv4();
      await setDoc(doc(db, 'reportLogs', logId), {
        id: logId,
        userId: user.uid,
        userName: user.displayName || user.email || 'Usuário',
        timestamp: new Date().toISOString(),
        reportType: `Inovação (${type})`
      });
    }
  };

  const toggleFilter = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter(i => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  return (
    <div className="p-6 space-y-12 w-full">
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Relatórios de Inovação</h3>
          <p className="text-slate-500 text-sm mt-1">Gere relatórios detalhados dos projetos de inovação em Excel ou PDF.</p>
        </div>

        <div className="bg-slate-50/50 p-6 lg:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Filtros Dropdowns */}
            <div className="flex flex-1 flex-wrap items-center gap-4">
               <FilterGroup 
                label="Selecionar Projeto" 
                options={projects.map(p => ({ id: p.id, label: p.title }))} 
                selected={selectedProjectIds} 
                onToggle={(id) => toggleFilter(selectedProjectIds, id, setSelectedProjectIds)} 
              />
               <FilterGroup 
                label="Selecionar Responsável" 
                options={users.map(u => ({ id: u.id, label: u.name }))} 
                selected={selectedResponsibles} 
                onToggle={(id) => toggleFilter(selectedResponsibles, id, setSelectedResponsibles)} 
              />
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={generateExcel}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              >
                <Download size={18} />
                Gerar Excel
              </button>
              <button 
                onClick={generatePDF}
                className="flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
              >
                <FileText size={18} />
                Gerar PDF
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-600">
              <Briefcase size={14} />
              <span>{filteredProjects.length} Projetos filtrados</span>
            </div>
          </div>
        </div>

        {/* Preview Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Prévia dos Resultados</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Projeto</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsável</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ganhos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredProjects.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{p.title}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{p.description || 'Sem descrição'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[8px] uppercase">
                          {p.responsibleName ? p.responsibleName[0] : '?'}
                        </div>
                        <span className="text-xs font-medium text-slate-600">{p.responsibleName || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider",
                        p.status === 'concluído' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold text-slate-500">{p.innovationType || '---'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-slate-400">Est: <span className="text-slate-600">R$ {(p.estimatedGain || 0).toLocaleString()}</span></span>
                        <span className="text-[10px] font-bold text-slate-400">Real: <span className="text-emerald-600">R$ {(p.realGain || 0).toLocaleString()}</span></span>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProjects.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Nenhum projeto encontrado.</td>
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

function FilterGroup({ label, options, selected, onToggle }: { 
  label: string, 
  options: { id: string, label: string }[], 
  selected: string[], 
  onToggle: (id: string) => void 
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative group/filter">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-4 py-3 bg-white border rounded-xl text-xs font-bold transition-all",
          selected.length > 0 ? "border-indigo-200 text-indigo-600 bg-indigo-50/30" : "border-slate-200 text-slate-600 hover:border-slate-300"
        )}
      >
        <Filter size={14} />
        <span>{label} {selected.length > 0 && `(${selected.length})`}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 p-2 max-h-[300px] overflow-y-auto custom-scrollbar"
            >
              {options.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => onToggle(opt.id)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                >
                  <span className={cn("text-[10px] font-bold uppercase tracking-wider", selected.includes(opt.id) ? "text-indigo-600" : "text-slate-500")}>
                    {opt.label}
                  </span>
                  {selected.includes(opt.id) && <CheckCircle2 size={14} className="text-indigo-600" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
