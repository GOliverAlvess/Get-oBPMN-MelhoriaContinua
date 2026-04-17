import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Modeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import 'bpmn-js/dist/assets/bpmn-js.css';

import { 
  Settings2, 
  Trash2, 
  X, 
  Palette, 
  Maximize2, 
  Clock, 
  Layers, 
  Download, 
  Undo2, 
  Redo2,
  GitBranch,
  Search,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';

import { Project, BPMNTaskData, SavedColor } from '../types';
import { cn } from '../lib/utils';

interface BPMNModelerProps {
  mapping: any;
  onUpdateMapping: (mapping: any) => void;
  projectName: string;
  savedColors: SavedColor[];
  onSaveGlobalColor: (color: SavedColor) => void;
  onDeleteGlobalColor: (id: string) => void;
}

const INITIAL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="173" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export default function BPMNModeler({ 
  mapping, 
  onUpdateMapping, 
  projectName,
  savedColors,
  onSaveGlobalColor,
  onDeleteGlobalColor
}: BPMNModelerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<Modeler | null>(null);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [customData, setCustomData] = useState<Record<string, Partial<BPMNTaskData>>>(mapping.customData || {});
  const customDataRef = useRef(customData);
  const [newColorName, setNewColorName] = useState('');
  const isSyncingRef = useRef(false);
  const isLoadedRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    customDataRef.current = customData;
  }, [customData]);

  // Initialize Modeler
  useEffect(() => {
    if (!containerRef.current) return;

    const modeler = new Modeler({
      container: containerRef.current,
      keyboard: {
        bindOn: window
      }
    });

    modelerRef.current = modeler;

    let isMounted = true;
    const xml = mapping.xml || INITIAL_XML;
    
    // Small delay to ensure container is fully ready in the DOM
    setTimeout(() => {
      if (!isMounted || !modeler) return;

      modeler.importXML(xml).then(() => {
        if (!isMounted) return;
        isLoadedRef.current = true;
        const canvas = modeler.get('canvas') as any;
        if (canvas) {
          try {
            canvas.zoom('fit-viewport');
          } catch (e) {
            console.warn('Could not zoom to fit-viewport', e);
          }
        }
      }).catch(err => {
        if (isMounted) {
          console.error('Error importing XML', err);
        }
      });
    }, 100);

    // Event Listeners
    modeler.on('selection.changed', (e: any) => {
      const selection = e.newSelection[0];
      setSelectedElement(selection || null);
    });

    modeler.on('element.changed', (e: any) => {
      if (isSyncingRef.current) return;
      
      const element = e.element;
      if (element.type === 'label' || !element.businessObject) return;

      const newLabel = element.businessObject.name || '';
      setCustomData(prev => {
        const currentData = prev[element.id] || {};
        if (currentData.description === newLabel) return prev;
        
        return {
          ...prev,
          [element.id]: {
            ...currentData,
            description: newLabel
          }
        };
      });

      saveChanges();
    });

    modeler.on('commandStack.changed', () => {
      if (isSyncingRef.current) return;
      saveChanges();
    });

    modeler.on('shape.removed', (e: any) => {
      const element = e.element;
      if (element.type === 'label') return;
      
      setCustomData(prev => {
        if (!prev[element.id]) return prev;
        const next = { ...prev };
        delete next[element.id];
        return next;
      });
    });

    return () => {
      isMounted = false;
      modeler.destroy();
    };
  }, []);

  const saveChanges = useCallback(async () => {
    if (!modelerRef.current || !isLoadedRef.current) return;
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      isSyncingRef.current = true;
      onUpdateMapping({
        ...mapping,
        xml,
        customData: customDataRef.current,
        lastEdited: new Date().toISOString()
      });
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 100);
    } catch (err) {
      console.error('Error saving XML', err);
    }
  }, [mapping, onUpdateMapping]);

  const updateElementData = (elementId: string, data: Partial<BPMNTaskData>) => {
    const newCustomData = {
      ...customData,
      [elementId]: {
        ...(customData[elementId] || {}),
        ...data
      }
    };
    setCustomData(newCustomData);

    // If description changed, update BPMN business object (it's the main visual text)
    if (data.description !== undefined && modelerRef.current) {
      const modeling = modelerRef.current.get('modeling');
      const element = modelerRef.current.get('elementRegistry').get(elementId);
      if (element) {
        modeling.updateLabel(element, data.description);
      }
    }

    // Update colors in BPMN
    if ((data.backgroundColor || data.borderColor) && modelerRef.current) {
      const modeling = modelerRef.current.get('modeling');
      const element = modelerRef.current.get('elementRegistry').get(elementId);
      if (element) {
        modeling.setColor(element, {
          fill: data.backgroundColor,
          stroke: data.borderColor
        });
      }
    }
  };

  // Sync custom data to project
  useEffect(() => {
    if (JSON.stringify(customData) !== JSON.stringify(mapping.customData)) {
      saveChanges();
    }
  }, [customData]);

  const totalTime = useMemo(() => {
    if (!modelerRef.current) return 0;
    const elementRegistry = modelerRef.current.get('elementRegistry');
    return Object.entries(customData).reduce((acc, [id, curr]: [string, any]) => {
      // Only count if the element still exists in diagram
      if (elementRegistry.get(id)) {
        return acc + (curr.timeInMinutes || 0);
      }
      return acc;
    }, 0);
  }, [customData]);

  // Update overlays for problem steps
  useEffect(() => {
    if (!modelerRef.current) return;
    const overlays = modelerRef.current.get('overlays') as any;
    const elementRegistry = modelerRef.current.get('elementRegistry');

    // Clear existing problem overlays
    overlays.remove({ type: 'problem-indicator' });

    Object.entries(customData).forEach(([id, data]: [string, any]) => {
      if (data.isProblemStep) {
        const element = elementRegistry.get(id);
        if (element) {
          overlays.add(id, 'problem-indicator', {
            position: {
              top: -10,
              right: -10
            },
            html: `<div class="bg-rose-500 text-white p-1 rounded-full shadow-lg border-2 border-white animate-pulse flex items-center justify-center" title="Etapa Problema">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                   </div>`
          });
        }
      }
    });
  }, [customData]);

  const exportAsPng = async () => {
    if (!modelerRef.current) return;
    try {
      const { svg } = await modelerRef.current.saveSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `processo-${projectName}.svg`;
      link.click();
    } catch (err) {
      console.error('Error exporting SVG', err);
    }
  };

  const saveCurrentColor = () => {
    if (!selectedElement || !newColorName.trim()) return;
    const elementId = selectedElement.id;
    const data = customData[elementId] || {};
    
    // Check if color is already in library with same name
    if (savedColors.some(c => c.name.toLowerCase() === newColorName.toLowerCase().trim())) {
      alert('Já existe uma cor com este nome na biblioteca.');
      return;
    }

    const newColor: SavedColor = {
      id: uuidv4(),
      name: newColorName.trim(),
      backgroundColor: data.backgroundColor || '#ffffff',
      borderColor: data.borderColor || '#333333'
    };

    onSaveGlobalColor(newColor);
    setNewColorName('');
  };

  const undo = () => modelerRef.current?.get('commandStack').undo();
  const redo = () => modelerRef.current?.get('commandStack').redo();

  const currentElementData = selectedElement ? (customData[selectedElement.id] || {
    label: selectedElement.businessObject.name || '',
    description: '',
    responsibleRole: '',
    timeInMinutes: 0,
    isProblemStep: false,
    backgroundColor: '#ffffff',
    borderColor: '#333333'
  }) : null;

  return (
    <div className="h-[800px] flex flex-col relative bg-white font-sans overflow-hidden">
      {/* Header Toolbar */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-auto h-10 bg-white rounded-lg flex items-center justify-center shadow-md border border-slate-100 p-1">
              <img 
                src="/assets/logo-flowprocess.svg" 
                alt="Logo" 
                style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 leading-none">{projectName}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Mapeamento BPMN</p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button onClick={undo} className="p-1.5 hover:bg-white rounded text-slate-500 transition-all" title="Desfazer">
              <Undo2 size={16} />
            </button>
            <button onClick={redo} className="p-1.5 hover:bg-white rounded text-slate-500 transition-all" title="Refazer">
              <Redo2 size={16} />
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex items-center gap-4 px-4 border-l border-slate-200">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tempo Total</span>
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-indigo-600" />
                <span className="text-sm font-black text-slate-700">{totalTime} min</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={exportAsPng}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Download size={14} />
            Exportar SVG
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Modeler Container */}
        <div ref={containerRef} className="flex-1 h-full bpmn-container" />

        {/* Right Properties Panel */}
        <AnimatePresence>
          {selectedElement && (
            <motion.div 
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              className="w-80 bg-white border-l border-slate-200 flex flex-col z-20 shadow-2xl overflow-y-auto"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Settings2 size={14} className="text-indigo-600" />
                  Propriedades BPMN
                </h4>
                <button onClick={() => setSelectedElement(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome (Interno)</label>
                    <input 
                      type="text" 
                      value={currentElementData?.label || ''}
                      onChange={(e) => updateElementData(selectedElement.id, { label: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição (Texto da Task)</label>
                    <textarea 
                      value={currentElementData?.description || ''}
                      onChange={(e) => updateElementData(selectedElement.id, { description: e.target.value })}
                      rows={3}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-700 text-xs resize-none"
                      placeholder="Este texto aparecerá dentro da task no canvas..."
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tempo (min)</label>
                      <input 
                        type="number" 
                        value={currentElementData?.timeInMinutes || 0}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateElementData(selectedElement.id, { timeInMinutes: parseInt(e.target.value) || 0 })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Etapa Problema</span>
                      <span className="text-[10px] text-slate-400 font-medium">Marcar como gargalo</span>
                    </div>
                    <button 
                      onClick={() => updateElementData(selectedElement.id, { isProblemStep: !currentElementData?.isProblemStep })}
                      className={cn(
                        "w-10 h-5 rounded-full p-1 transition-all",
                        currentElementData?.isProblemStep ? "bg-rose-500" : "bg-slate-200"
                      )}
                    >
                      <div className={cn("w-3 h-3 bg-white rounded-full transition-all", currentElementData?.isProblemStep ? "translate-x-5" : "translate-x-0")} />
                    </button>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Palette size={12} />
                    Aparência BPMN
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Fundo</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color" 
                          value={currentElementData?.backgroundColor || '#ffffff'}
                          onChange={(e) => updateElementData(selectedElement.id, { backgroundColor: e.target.value })}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                        />
                        <span className="text-[10px] font-mono text-slate-400">{currentElementData?.backgroundColor || '#ffffff'}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Borda</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color" 
                          value={currentElementData?.borderColor || '#333333'}
                          onChange={(e) => updateElementData(selectedElement.id, { borderColor: e.target.value })}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                        />
                        <span className="text-[10px] font-mono text-slate-400">{currentElementData?.borderColor || '#333333'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Palette size={12} />
                      Biblioteca de Cores
                    </div>
                    <span className="text-[9px] font-bold text-indigo-500 tabular-nums">
                      {savedColors.length} cores
                    </span>
                  </label>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {savedColors.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {savedColors.map((color) => (
                          <div 
                            key={color.id}
                            className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-100 rounded-xl group hover:border-indigo-200 transition-all cursor-pointer"
                            onClick={() => updateElementData(selectedElement.id, { 
                              backgroundColor: color.backgroundColor,
                              borderColor: color.borderColor
                            })}
                          >
                            <div 
                              className="w-8 h-8 rounded-lg border-2 shadow-sm shrink-0"
                              style={{ backgroundColor: color.backgroundColor, borderColor: color.borderColor }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-black text-slate-700 truncate">{color.name}</p>
                              <p className="text-[8px] font-mono text-slate-400 mt-0.5">{color.backgroundColor}</p>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Deseja excluir a cor "${color.name}" da biblioteca?`)) {
                                  onDeleteGlobalColor(color.id);
                                }
                              }}
                              className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhuma cor salva</p>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-indigo-600 uppercase tracking-widest ml-1">Salvar Cor Atual</label>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Ex: Etapa Crítica"
                          value={newColorName}
                          onChange={(e) => setNewColorName(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white border border-indigo-100 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        />
                        <button 
                          onClick={saveCurrentColor}
                          disabled={!newColorName.trim()}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tight disabled:opacity-50 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .bpmn-container {
          background-color: #f8fafc;
          background-image: radial-gradient(#e2e8f0 1px, transparent 1px);
          background-size: 20px 20px;
        }
        .bjs-powered-by {
          display: none !important;
        }
        .djs-palette {
          top: 20px !important;
          left: 20px !important;
          border-radius: 12px !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
          background: white !important;
        }
        .djs-context-pad {
          border-radius: 8px !important;
          border: 1px solid #e2e8f0 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
          background: white !important;
        }
      `}} />
    </div>
  );
}
