import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronDown, X, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

// Interface das propriedades recebidas pelo componente de Dropdown de Filtro Multiseleção
interface FilterDropdownProps {
  label: string; // Título explicativo exibido acima do dropdown
  placeholder: string; // Mensagem informativa padrão quando nada está selecionado
  options: { id: string, label: string }[]; // Lista de opções que podem ser selecionadas
  selected: string[]; // Lista contendo os IDs das opções selecionadas atualmente
  onToggle: (id: string) => void; // Gatilho acionado ao marcar/desmarcar uma opção
  onClear: () => void; // Gatilho acionado ao limpar todas as seleções consecutivamente
  icon: React.ReactNode; // Ícone decorativo exibido no corpo principal do dropdown
  showSearch?: boolean; // Booleano sinalizando se um campo de pesquisa interno deve ser exibido
}

// Componente reativo que cria um seletor suspenso elegante com filtro de busca interno para multiseleção
export default function FilterDropdown({ 
  label, 
  placeholder, 
  options, 
  selected, 
  onToggle, 
  onClear, 
  icon,
  showSearch = false
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false); // Armazena o estado de abertura da lista flutuante
  const [searchTerm, setSearchTerm] = useState(''); // Armazena o termo digitado na caixa de busca
  const dropdownRef = useRef<HTMLDivElement>(null); // Referência DOM usada para gerenciar cliques fora do componente

  // Efeito colateral encarregado de escutar cliques globais no documento para fechar o dropdown caso o usuário clique fora dele
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtra as opções disponíveis de acordo com o termo buscado na caixa de texto
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-1.5 relative" ref={dropdownRef}>
      {/* Etiqueta textual exibida no topo */}
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      
      {/* Gatilho de abertura do menu suspenso */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 transition-all",
          isOpen && "border-indigo-500 ring-2 ring-indigo-50"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <span className="text-slate-400">{icon}</span>
          <span className={cn(
            "text-sm font-medium truncate",
            selected.length > 0 ? "text-slate-900" : "text-slate-400"
          )}>
            {selected.length > 0 
              ? `${selected.length} selecionado${selected.length > 1 ? 's' : ''}` 
              : placeholder}
          </span>
        </div>
        
        {/* Ícone de seta e botão opcional de limpar seleção de forma rápida (X) */}
        <div className="flex items-center gap-1">
          {selected.length > 0 && (
            <button 
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} className={cn("text-slate-400 transition-transform", isOpen && "rotate-180")} />
        </div>
      </div>

      {/* Menu suspenso flutuante com animações suaves de entrada e saída */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute z-50 top-full left-0 right-0 mt-2 bg-theme-card border border-theme-border rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Campo de pesquisa caso habilitado nas propriedades do dropdown */}
            {showSearch && (
              <div className="p-3 border-b border-theme-border">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-all"
                    onClick={(e) => e.stopPropagation()} // Previne que o click na caixa feche o menu flutuante asquerosamente
                  />
                </div>
              </div>
            )}
            
            {/* Seleta com listagem de checkboxes com rolagem customizada */}
            <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
              {filteredOptions.map(opt => (
                <div 
                  key={opt.id}
                  onClick={() => onToggle(opt.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                    selected.includes(opt.id) 
                      ? "bg-indigo-50 text-indigo-700" 
                      : "hover:bg-slate-50 text-slate-600"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-all",
                    selected.includes(opt.id)
                      ? "bg-indigo-600 border-indigo-600"
                      : "border-slate-300 bg-white"
                  )}>
                    {selected.includes(opt.id) && <CheckCircle2 size={10} className="text-white" />}
                  </div>
                  <span className="text-sm font-medium">{opt.label}</span>
                </div>
              ))}
              
              {/* Fallback de layout caso a filtragem resulte em lista vazia */}
              {filteredOptions.length === 0 && (
                <p className="text-center py-4 text-xs text-slate-400 italic">Nenhum resultado encontrado</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
