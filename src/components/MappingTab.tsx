import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  Connection, 
  Edge, 
  Node, 
  useNodesState, 
  useEdgesState,
  Panel,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Save, 
  Layout, 
  Plus, 
  Trash2, 
  Settings2, 
  Clock, 
  AlertCircle,
  HelpCircle,
  Palette,
  GitBranch,
  X,
  Check
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

import { Project, BPMNTaskData, BPMNShapeType, SavedColor } from '../types';
import BPMNTaskNode from './BPMNTaskNode';
import { cn } from '../lib/utils';

const nodeTypes = {
  bpmnTask: BPMNTaskNode,
};

const SHAPES: { type: BPMNShapeType; label: string; path: string }[] = [
  { type: 'rectangle', label: 'Retângulo', path: 'M 5 5 L 95 5 L 95 95 L 5 95 Z' },
  { type: 'rounded-rectangle', label: 'Retângulo Arredondado', path: 'M 20 5 L 80 5 A 15 15 0 0 1 95 20 L 95 80 A 15 15 0 0 1 80 95 L 20 95 A 15 15 0 0 1 5 80 L 5 20 A 15 15 0 0 1 20 5' },
  { type: 'circle', label: 'Círculo', path: 'M 50 50 m -45, 0 a 45,45 0 1,0 90,0 a 45,45 0 1,0 -90,0' },
  { type: 'diamond', label: 'Losango', path: 'M 50 5 L 95 50 L 50 95 L 5 50 Z' },
  { type: 'hexagon', label: 'Hexágono', path: 'M 25 5 L 75 5 L 95 50 L 75 95 L 25 95 L 5 50 Z' },
  { type: 'triangle', label: 'Triângulo', path: 'M 50 5 L 95 95 L 5 95 Z' },
  { type: 'cylinder', label: 'Cilindro', path: 'M 5 20 A 45 15 0 0 1 95 20 L 95 80 A 45 15 0 0 1 5 80 Z' },
  { type: 'cloud', label: 'Nuvem', path: 'M 25 40 A 15 15 0 0 1 50 30 A 20 20 0 0 1 85 45 A 15 15 0 0 1 75 75 A 15 15 0 0 1 25 75 A 15 15 0 0 1 15 55 A 15 15 0 0 1 25 40 Z' },
  { type: 'document', label: 'Documento', path: 'M 10 5 L 70 5 L 90 25 L 90 95 L 10 95 Z M 70 5 L 70 25 L 90 25' },
  { type: 'data-storage', label: 'Banco de Dados', path: 'M 5 15 A 45 10 0 0 1 95 15 L 95 85 A 45 10 0 0 1 5 85 Z' },
];

export default function MappingTab({ project, setProjects }: { project: Project, setProjects: (p: Project) => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(project.mapping.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(project.mapping.edges);

  // Sync with project prop if it changes from outside (e.g. Firestore update)
  useEffect(() => {
    // Only update if the content is actually different to avoid loops
    const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(project.mapping.nodes);
    const edgesChanged = JSON.stringify(edges) !== JSON.stringify(project.mapping.edges);
    
    if (nodesChanged) setNodes(project.mapping.nodes);
    if (edgesChanged) setEdges(project.mapping.edges);
  }, [project.mapping.nodes, project.mapping.edges]);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>(project.mapping.orientation);
  const [selectedNode, setSelectedNode] = useState<Node<BPMNTaskData> | null>(null);
  const [isSelectingShape, setIsSelectingShape] = useState(false);
  const [newColorName, setNewColorName] = useState('');

  // Auto-save logic
  useEffect(() => {
    // Check if anything actually changed compared to the project prop
    const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(project.mapping.nodes);
    const edgesChanged = JSON.stringify(edges) !== JSON.stringify(project.mapping.edges);
    const orientationChanged = orientation !== project.mapping.orientation;

    if (!nodesChanged && !edgesChanged && !orientationChanged) return;

    const timer = setTimeout(() => {
      setProjects({ 
        ...project, 
        mapping: { 
          ...project.mapping, 
          nodes, 
          edges, 
          orientation, 
          lastEdited: new Date().toISOString() 
        } 
      });
    }, 2000); // 2s debounce for mapping
    return () => clearTimeout(timer);
  }, [nodes, edges, orientation, project.id, setProjects]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge({
    ...params,
    type: 'smoothstep',
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
    style: { stroke: '#64748b', strokeWidth: 2 }
  }, eds)), [setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node as Node<BPMNTaskData>);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const addNewTask = (shapeType: BPMNShapeType) => {
    const newNode: Node<BPMNTaskData> = {
      id: uuidv4(),
      type: 'bpmnTask',
      position: { x: 100, y: 100 },
      data: { 
        label: 'Nova Tarefa', 
        responsibleRole: '', 
        timeInMinutes: 0, 
        isProblemStep: false,
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        shapeType
      },
    };
    setNodes((nds) => nds.concat(newNode));
    setIsSelectingShape(false);
    setSelectedNode(newNode);
  };

  const updateNodeData = (id: string, newData: Partial<BPMNTaskData>) => {
    setNodes((nds) => nds.map((node) => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, ...newData } };
      }
      return node;
    }));
    if (selectedNode?.id === id) {
      setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, ...newData } } : null);
    }
  };

  const saveCurrentColor = () => {
    if (!selectedNode || !newColorName) return;
    const newSavedColor: SavedColor = {
      id: uuidv4(),
      name: newColorName,
      backgroundColor: selectedNode.data.backgroundColor,
      borderColor: selectedNode.data.borderColor
    };
    setProjects({ 
      ...project, 
      savedColors: [...(project.savedColors || []), newSavedColor] 
    });
    setNewColorName('');
  };

  const deleteNode = (id: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    setSelectedNode(null);
  };

  const totalTime = useMemo(() => {
    return nodes.reduce((sum, node) => sum + (node.data.timeInMinutes || 0), 0);
  }, [nodes]);

  return (
    <div className="h-[700px] flex flex-col relative bg-slate-50">
      {/* Toolbar */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
              <GitBranch size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Mapeamento de Processo</h3>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Última edição: {format(new Date(project.mapping.lastEdited), 'HH:mm:ss')}
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200" />

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <Clock size={16} className="text-slate-500" />
              <span className="text-sm font-bold text-slate-700">{totalTime} min</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Tempo Total</span>
            </div>

            <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-lg">
              <button 
                onClick={() => setOrientation('horizontal')}
                className={cn(
                  "px-3 py-1 rounded text-xs font-bold transition-all",
                  orientation === 'horizontal' ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                Horizontal
              </button>
              <button 
                onClick={() => setOrientation('vertical')}
                className={cn(
                  "px-3 py-1 rounded text-xs font-bold transition-all",
                  orientation === 'vertical' ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                Vertical
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSelectingShape(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
          >
            <Plus size={18} />
            Tarefa
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Legend Sidebar */}
        <div className="w-64 bg-white border-r border-slate-200 p-4 overflow-y-auto hidden xl:block">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <HelpCircle size={14} />
            Legenda BPMN
          </h4>
          <div className="space-y-6">
            <LegendSection title="Atividades" items={[
              { icon: <div className="w-6 h-4 border-2 border-slate-400 rounded" />, label: "Tarefa (Task)" },
              { icon: <div className="w-6 h-4 border-2 border-slate-400 rounded flex items-center justify-center"><Plus size={8} /></div>, label: "Subprocesso" },
            ]} />
            <LegendSection title="Eventos" items={[
              { icon: <div className="w-5 h-5 border-2 border-emerald-500 rounded-full" />, label: "Início (Start)" },
              { icon: <div className="w-5 h-5 border-2 border-rose-500 rounded-full border-dashed" />, label: "Intermediário" },
              { icon: <div className="w-5 h-5 border-4 border-rose-600 rounded-full" />, label: "Fim (End)" },
            ]} />
            <LegendSection title="Desvios" items={[
              { icon: <div className="w-5 h-5 border-2 border-amber-500 rotate-45" />, label: "Exclusivo (XOR)" },
              { icon: <div className="w-5 h-5 border-2 border-amber-500 rotate-45 flex items-center justify-center"><Plus size={8} className="rotate-[-45deg]" /></div>, label: "Paralelo (AND)" },
            ]} />
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#cbd5e1" gap={20} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Shape Selection Modal */}
        <AnimatePresence>
          {isSelectingShape && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-8"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-full"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h4 className="text-xl font-black text-slate-800 flex items-center gap-3">
                    <Layout className="text-indigo-600" />
                    Selecione a Forma da Etapa
                  </h4>
                  <button 
                    onClick={() => setIsSelectingShape(false)}
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X size={24} className="text-slate-400" />
                  </button>
                </div>
                <div className="p-8 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                  {SHAPES.map((shape) => (
                    <button 
                      key={shape.type}
                      onClick={() => addNewTask(shape.type)}
                      className="flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all group"
                    >
                      <div className="w-16 h-16 flex items-center justify-center">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                          <path 
                            d={shape.path} 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            className="text-slate-400 group-hover:text-indigo-600 transition-colors"
                          />
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-700 text-center">
                        {shape.label}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Configuration Panel */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div 
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              className="w-80 bg-white border-l border-slate-200 p-6 shadow-2xl z-20 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h4 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Settings2 size={18} className="text-indigo-600" />
                  Configurar Etapa
                </h4>
                <button 
                  onClick={() => deleteNode(selectedNode.id)}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome da Etapa</label>
                  <input 
                    type="text" 
                    value={selectedNode.data.label}
                    onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo Responsável</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Operador, Gerente..."
                    value={selectedNode.data.responsibleRole}
                    onChange={(e) => updateNodeData(selectedNode.id, { responsibleRole: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tempo da Etapa (minutos)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={selectedNode.data.timeInMinutes}
                      onChange={(e) => updateNodeData(selectedNode.id, { timeInMinutes: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 pl-10"
                    />
                    <Clock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={selectedNode.data.isProblemStep}
                        onChange={(e) => updateNodeData(selectedNode.id, { isProblemStep: e.target.checked })}
                      />
                      <div className={cn(
                        "w-12 h-6 rounded-full transition-all",
                        selectedNode.data.isProblemStep ? "bg-rose-500" : "bg-slate-200"
                      )} />
                      <div className={cn(
                        "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all",
                        selectedNode.data.isProblemStep ? "translate-x-6" : "translate-x-0"
                      )} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700">Etapa Problema</span>
                      <span className="text-[10px] text-slate-400 font-medium">Marcar como gargalo ou falha</span>
                    </div>
                  </label>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Palette size={14} />
                    Personalizar Cores
                  </label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Fundo</span>
                      <input 
                        type="color" 
                        value={selectedNode.data.backgroundColor}
                        onChange={(e) => updateNodeData(selectedNode.id, { backgroundColor: e.target.value })}
                        className="w-full h-10 rounded-lg cursor-pointer bg-transparent"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Borda</span>
                      <input 
                        type="color" 
                        value={selectedNode.data.borderColor}
                        onChange={(e) => updateNodeData(selectedNode.id, { borderColor: e.target.value })}
                        className="w-full h-10 rounded-lg cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Nome da cor..."
                        value={newColorName}
                        onChange={(e) => setNewColorName(e.target.value)}
                        className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                      />
                      <button 
                        onClick={saveCurrentColor}
                        disabled={!newColorName}
                        className="p-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                      >
                        <Save size={16} />
                      </button>
                    </div>
                  </div>

                  {project.savedColors && project.savedColors.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Cores Salvas</span>
                      <div className="grid grid-cols-4 gap-2">
                        {project.savedColors.map((color) => (
                          <button 
                            key={color.id}
                            title={color.name}
                            onClick={() => updateNodeData(selectedNode.id, { backgroundColor: color.backgroundColor, borderColor: color.borderColor })}
                            className="h-8 rounded-lg border-2 transition-all hover:scale-110"
                            style={{ backgroundColor: color.backgroundColor, borderColor: color.borderColor }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LegendSection({ title, items }: { title: string, items: { icon: React.ReactNode, label: string }[] }) {
  return (
    <div className="space-y-3">
      <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</h5>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 text-xs text-slate-600 font-medium">
            <div className="w-8 flex justify-center">{item.icon}</div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
