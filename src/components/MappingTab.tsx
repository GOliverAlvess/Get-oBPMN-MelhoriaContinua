import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  BackgroundVariant,
  XYPosition
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
  Check,
  Undo2,
  Redo2,
  Download,
  Maximize2,
  Minimize2,
  Search,
  Layers,
  MousePointer2,
  Move
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import dagre from 'dagre';
import { toPng, toSvg } from 'html-to-image';

import { Project, BPMNTaskData, BPMNShapeType, SavedColor } from '../types';
import BPMNTaskNode from './BPMNTaskNode';
import { cn } from '../lib/utils';

const nodeTypes = {
  bpmnTask: BPMNTaskNode,
};

const SHAPES: { type: BPMNShapeType; label: string; path: string; defaultWidth: number; defaultHeight: number; category: 'Básico' | 'BPMN' | 'Customizados' }[] = [
  { type: 'startEvent', label: 'Início', path: 'M 50 50 m -40, 0 a 40,40 0 1,0 80,0 a 40,40 0 1,0 -80,0', defaultWidth: 60, defaultHeight: 60, category: 'BPMN' },
  { type: 'task', label: 'Tarefa', path: 'M 10 20 L 90 20 L 90 80 L 10 80 Z', defaultWidth: 150, defaultHeight: 100, category: 'Básico' },
  { type: 'gateway', label: 'Gateway', path: 'M 50 10 L 90 50 L 50 90 L 10 50 Z', defaultWidth: 80, defaultHeight: 80, category: 'BPMN' },
  { type: 'subprocess', label: 'Subprocesso', path: 'M 10 20 L 90 20 L 90 80 L 10 80 Z M 45 70 L 55 70 M 50 65 L 50 75', defaultWidth: 200, defaultHeight: 150, category: 'BPMN' },
  { type: 'endEvent', label: 'Fim', path: 'M 50 50 m -40, 0 a 40,40 0 1,0 80,0 a 40,40 0 1,0 -80,0', defaultWidth: 60, defaultHeight: 60, category: 'BPMN' },
  { type: 'document', label: 'Documento', path: 'M 20 10 L 70 10 L 85 25 L 85 90 L 20 90 Z', defaultWidth: 100, defaultHeight: 120, category: 'Básico' },
  { type: 'data-storage', label: 'Banco de Dados', path: 'M 10 20 A 40 10 0 0 1 90 20 L 90 80 A 40 10 0 0 1 10 80 Z', defaultWidth: 120, defaultHeight: 100, category: 'Customizados' },
];

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: node.width || 150, height: node.height || 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - (node.width || 150) / 2,
      y: nodeWithPosition.y - (node.height || 100) / 2,
    };
    return node;
  });
};

function FlowEditor({ project, setProjects }: { project: Project, setProjects: (p: Project) => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(project.mapping.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(project.mapping.edges);
  const { fitView, zoomIn, zoomOut, setViewport, getViewport } = useReactFlow();

  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>(project.mapping.orientation);
  const [selectedNode, setSelectedNode] = useState<Node<BPMNTaskData> | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [newColorName, setNewColorName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [history, setHistory] = useState<{ nodes: Node[], edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const isSyncingRef = useRef(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Sync from project prop to local state
  useEffect(() => {
    if (isSyncingRef.current) return;
    const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(project.mapping.nodes);
    const edgesChanged = JSON.stringify(edges) !== JSON.stringify(project.mapping.edges);
    if (nodesChanged) setNodes(project.mapping.nodes);
    if (edgesChanged) setEdges(project.mapping.edges);
  }, [project.mapping.nodes, project.mapping.edges]);

  // Sync from local state to project prop
  useEffect(() => {
    const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(project.mapping.nodes);
    const edgesChanged = JSON.stringify(edges) !== JSON.stringify(project.mapping.edges);
    const orientationChanged = orientation !== project.mapping.orientation;

    if (nodesChanged || edgesChanged || orientationChanged) {
      isSyncingRef.current = true;
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
      
      // History management
      if (!isSyncingRef.current) {
        const newState = { nodes, edges };
        setHistory(prev => [...prev.slice(0, historyIndex + 1), newState].slice(-50));
        setHistoryIndex(prev => prev + 1);
      }

      const timer = setTimeout(() => {
        isSyncingRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes, edges, orientation]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({
      ...params,
      type: 'smoothstep',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
      style: { stroke: '#64748b', strokeWidth: 2 }
    }, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node as Node<BPMNTaskData>);
    setSelectedEdge(null);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const shapeType = event.dataTransfer.getData('shapeType') as BPMNShapeType;
      const label = event.dataTransfer.getData('label');
      const defaultWidth = parseInt(event.dataTransfer.getData('defaultWidth'));
      const defaultHeight = parseInt(event.dataTransfer.getData('defaultHeight'));

      if (typeof type === 'undefined' || !type) return;

      const position = {
        x: event.clientX - (reactFlowWrapper.current?.getBoundingClientRect().left || 0),
        y: event.clientY - (reactFlowWrapper.current?.getBoundingClientRect().top || 0),
      };

      const newNode: Node<BPMNTaskData> = {
        id: uuidv4(),
        type,
        position,
        width: defaultWidth,
        height: defaultHeight,
        data: { 
          label, 
          description: '',
          responsibleRole: '', 
          timeInMinutes: 0, 
          isProblemStep: false,
          backgroundColor: '#ffffff',
          borderColor: '#333333',
          shapeType,
          width: defaultWidth,
          height: defaultHeight
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const updateNodeData = useCallback((id: string, newData: Partial<BPMNTaskData>) => {
    setNodes((nds) => nds.map((node) => {
      if (node.id === id) {
        const updatedNode = { ...node, data: { ...node.data, ...newData } };
        if (newData.width) updatedNode.width = newData.width;
        if (newData.height) updatedNode.height = newData.height;
        return updatedNode;
      }
      return node;
    }));
    
    setSelectedNode(prev => {
      if (prev?.id === id) {
        const updated = { ...prev, data: { ...prev.data, ...newData } };
        if (newData.width) updated.width = newData.width;
        if (newData.height) updated.height = newData.height;
        return updated;
      }
      return prev;
    });
  }, [setNodes]);

  const onLayout = useCallback((direction: string) => {
    const layoutedNodes = getLayoutedElements(nodes, edges, direction);
    setNodes([...layoutedNodes]);
  }, [nodes, edges, setNodes]);

  const onUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      isSyncingRef.current = true;
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setHistoryIndex(prev => prev - 1);
      setTimeout(() => isSyncingRef.current = false, 100);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  const onRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      isSyncingRef.current = true;
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setHistoryIndex(prev => prev + 1);
      setTimeout(() => isSyncingRef.current = false, 100);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  const exportAsPng = useCallback(() => {
    if (reactFlowWrapper.current === null) return;
    toPng(reactFlowWrapper.current, {
      cacheBust: true,
      backgroundColor: '#f8fafc',
    }).then((dataUrl) => {
      const link = document.createElement('a');
      link.download = `fluxo-${project.name}.png`;
      link.href = dataUrl;
      link.click();
    });
  }, [project.name]);

  const exportAsSvg = useCallback(() => {
    if (reactFlowWrapper.current === null) return;
    toSvg(reactFlowWrapper.current, {
      cacheBust: true,
    }).then((dataUrl) => {
      const link = document.createElement('a');
      link.download = `fluxo-${project.name}.svg`;
      link.href = dataUrl;
      link.click();
    });
  }, [project.name]);

  const totalTime = useMemo(() => {
    return nodes.reduce((sum, node) => sum + (node.data.timeInMinutes || 0), 0);
  }, [nodes]);

  const saveCurrentColor = useCallback(() => {
    if (!selectedNode || !newColorName.trim()) return;
    
    const newColor: SavedColor = {
      id: uuidv4(),
      name: newColorName,
      backgroundColor: selectedNode.data.backgroundColor,
      borderColor: selectedNode.data.borderColor
    };

    const updatedProject = {
      ...project,
      mapping: {
        ...project.mapping,
        savedColors: [...(project.mapping.savedColors || []), newColor]
      }
    };
    
    setProjects(updatedProject);
    setNewColorName('');
  }, [selectedNode, newColorName, project, setProjects]);

  const nodesWithCallbacks = useMemo(() => {
    return nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onResize: (width: number, height: number) => updateNodeData(node.id, { width, height })
      }
    }));
  }, [nodes, updateNodeData]);

  const filteredShapes = SHAPES.filter(s => s.label.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-[800px] flex flex-col relative bg-slate-50 font-sans">
      {/* Header Toolbar */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <GitBranch size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 leading-none">{project.name}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Mapeamento</p>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button onClick={onUndo} disabled={historyIndex <= 0} className="p-1.5 hover:bg-white rounded text-slate-500 disabled:opacity-30 transition-all">
              <Undo2 size={16} />
            </button>
            <button onClick={onRedo} disabled={historyIndex >= history.length - 1} className="p-1.5 hover:bg-white rounded text-slate-500 disabled:opacity-30 transition-all">
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
            <div className="h-8 w-px bg-slate-100" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Etapas</span>
              <div className="flex items-center gap-1.5">
                <Layers size={14} className="text-indigo-600" />
                <span className="text-sm font-black text-slate-700">{nodes.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => onLayout('LR')}
              className="p-1.5 hover:bg-white rounded text-slate-500 hover:text-indigo-600 transition-all flex items-center gap-1.5 px-2"
              title="Layout Horizontal"
            >
              <Layout size={14} />
              <span className="text-[10px] font-bold uppercase">H</span>
            </button>
            <button 
              onClick={() => onLayout('TB')}
              className="p-1.5 hover:bg-white rounded text-slate-500 hover:text-indigo-600 transition-all flex items-center gap-1.5 px-2"
              title="Layout Vertical"
            >
              <Layout size={14} className="rotate-90" />
              <span className="text-[10px] font-bold uppercase">V</span>
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div className="relative group">
            <button className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
              <Download size={14} />
              Exportar
            </button>
            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
              <button onClick={exportAsPng} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 border-b border-slate-100">PNG Image</button>
              <button onClick={exportAsSvg} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">SVG Vector</button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbox */}
        <div className="w-64 bg-white border-r border-slate-200 flex flex-col z-10">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar elementos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {['Básico', 'BPMN', 'Customizados'].map(category => {
              const categoryShapes = filteredShapes.filter(s => s.category === category);
              if (categoryShapes.length === 0) return null;
              return (
                <div key={category} className="space-y-3">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Layers size={12} />
                    {category}
                  </h5>
                  <div className="grid grid-cols-2 gap-3">
                    {categoryShapes.map(shape => (
                      <div 
                        key={shape.type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/reactflow', 'bpmnTask');
                          e.dataTransfer.setData('shapeType', shape.type);
                          e.dataTransfer.setData('label', shape.label);
                          e.dataTransfer.setData('defaultWidth', shape.defaultWidth.toString());
                          e.dataTransfer.setData('defaultHeight', shape.defaultHeight.toString());
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all cursor-grab active:cursor-grabbing group"
                      >
                        <div className="w-10 h-10 flex items-center justify-center">
                          <svg viewBox="0 0 100 100" className="w-full h-full">
                            <path d={shape.path} fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                          </svg>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-700 text-center">{shape.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodesWithCallbacks}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            snapToGrid
            snapGrid={[15, 15]}
            fitView
            minZoom={0.25}
            maxZoom={2}
          >
            <Background variant={BackgroundVariant.Dots} gap={15} size={1} color="#e2e8f0" />
            <Controls className="!bg-white !border-slate-200 !shadow-xl !rounded-xl overflow-hidden" />
          </ReactFlow>
        </div>

        {/* Right Properties Panel */}
        <AnimatePresence>
          {(selectedNode || selectedEdge) && (
            <motion.div 
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              className="w-80 bg-white border-l border-slate-200 flex flex-col z-20 shadow-2xl"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Settings2 size={14} className="text-indigo-600" />
                  {selectedNode ? 'Propriedades da Etapa' : 'Propriedades da Conexão'}
                </h4>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      if (selectedNode) {
                        setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
                        setSelectedNode(null);
                      } else if (selectedEdge) {
                        setEdges(eds => eds.filter(e => e.id !== selectedEdge.id));
                        setSelectedEdge(null);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button onClick={() => { setSelectedNode(null); setSelectedEdge(null); }} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {selectedNode && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome da Etapa</label>
                        <input 
                          type="text" 
                          value={selectedNode.data.label}
                          onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</label>
                        <textarea 
                          value={selectedNode.data.description || ''}
                          onChange={(e) => updateNodeData(selectedNode.id, { description: e.target.value })}
                          rows={3}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-700 text-xs resize-none"
                          placeholder="Descreva o que acontece nesta etapa..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo</label>
                          <input 
                            type="text" 
                            value={selectedNode.data.responsibleRole}
                            onChange={(e) => updateNodeData(selectedNode.id, { responsibleRole: e.target.value })}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tempo (min)</label>
                          <input 
                            type="number" 
                            value={selectedNode.data.timeInMinutes}
                            onChange={(e) => updateNodeData(selectedNode.id, { timeInMinutes: parseInt(e.target.value) || 0 })}
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
                          onClick={() => updateNodeData(selectedNode.id, { isProblemStep: !selectedNode.data.isProblemStep })}
                          className={cn(
                            "w-10 h-5 rounded-full p-1 transition-all",
                            selectedNode.data.isProblemStep ? "bg-rose-500" : "bg-slate-200"
                          )}
                        >
                          <div className={cn("w-3 h-3 bg-white rounded-full transition-all", selectedNode.data.isProblemStep ? "translate-x-5" : "translate-x-0")} />
                        </button>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Palette size={12} />
                        Aparência
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Fundo</span>
                          <div className="flex items-center gap-2">
                            <input 
                              type="color" 
                              value={selectedNode.data.backgroundColor}
                              onChange={(e) => updateNodeData(selectedNode.id, { backgroundColor: e.target.value })}
                              className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                            />
                            <span className="text-[10px] font-mono text-slate-400">{selectedNode.data.backgroundColor}</span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Borda</span>
                          <div className="flex items-center gap-2">
                            <input 
                              type="color" 
                              value={selectedNode.data.borderColor}
                              onChange={(e) => updateNodeData(selectedNode.id, { borderColor: e.target.value })}
                              className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                            />
                            <span className="text-[10px] font-mono text-slate-400">{selectedNode.data.borderColor}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Maximize2 size={12} />
                        Dimensões
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Largura</span>
                          <input 
                            type="number" 
                            value={selectedNode.data.width || 150}
                            onChange={(e) => updateNodeData(selectedNode.id, { width: parseInt(e.target.value) || 50 })}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Altura</span>
                          <input 
                            type="number" 
                            value={selectedNode.data.height || 100}
                            onChange={(e) => updateNodeData(selectedNode.id, { height: parseInt(e.target.value) || 50 })}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Palette size={12} />
                        Cores Salvas
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(project.mapping.savedColors || []).map((color) => (
                          <button
                            key={color.id}
                            onClick={() => updateNodeData(selectedNode.id, { 
                              backgroundColor: color.backgroundColor,
                              borderColor: color.borderColor
                            })}
                            title={color.name}
                            className="w-full aspect-square rounded-lg border-2 transition-all hover:scale-110 shadow-sm"
                            style={{ backgroundColor: color.backgroundColor, borderColor: color.borderColor }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Nome da cor..."
                          value={newColorName}
                          onChange={(e) => setNewColorName(e.target.value)}
                          className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button 
                          onClick={saveCurrentColor}
                          disabled={!newColorName.trim()}
                          className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-tight disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedEdge && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Texto da Conexão</label>
                        <input 
                          type="text" 
                          value={selectedEdge.label as string || ''}
                          onChange={(e) => {
                            const newLabel = e.target.value;
                            setEdges(eds => eds.map(edge => 
                              edge.id === selectedEdge.id ? { ...edge, label: newLabel } : edge
                            ));
                            setSelectedEdge(prev => prev ? { ...prev, label: newLabel } : null);
                          }}
                          placeholder="Ex: Sim, Não, Condição..."
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-700 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function MappingTab(props: { project: Project, setProjects: (p: Project) => void }) {
  return (
    <ReactFlowProvider>
      <FlowEditor {...props} />
    </ReactFlowProvider>
  );
}
