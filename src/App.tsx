import React, { useState, useEffect, Component, useRef } from 'react';
import { 
  LayoutDashboard, 
  Plus, 
  Search, 
  MoreVertical, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ChevronRight,
  Target,
  GitBranch,
  RefreshCw,
  Users,
  User as UserIcon,
  FileText,
  Settings,
  LogOut,
  ArrowRight,
  Save,
  Trash2,
  Edit,
  Filter,
  ChevronDown,
  X,
  Activity,
  ExternalLink,
  Globe,
  Leaf,
  Heart,
  ShieldCheck,
  Briefcase,
  History,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { 
  auth, 
  db, 
  dbId,
  googleProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  setDoc, 
  doc, 
  addDoc, 
  deleteDoc, 
  handleFirestoreError, 
  OperationType,
  getDocs,
  getDoc
} from './firebase';
import type { FirebaseUser } from './firebase';
import { Project, ProjectStatus, ProjectPriority, User, Subtask, OperationalAction, SavedColor } from './types';
import { cn } from './lib/utils';
import MappingTab from './components/MappingTab';
import PDCAEditor from './components/PDCAEditor';
import DashboardView from './components/DashboardView';
import OperationalActionsTab from './components/OperationalActionsTab';
import ReportsTab from './components/ReportsTab';
import { calculateProjectProgress, calculateProjectStatus } from './lib/projectUtils';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<any, any> {
  public state: any = { hasError: false, error: null };

  constructor(props: any) {
    super(props);
  }

  static getDerivedStateFromError(error: any): any {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const firestoreError = JSON.parse(this.state.error.message);
        errorMessage = `Erro no Firestore (${firestoreError.operationType}): ${firestoreError.error}`;
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6 border border-slate-100">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Ops! Algo deu errado</h2>
            <p className="text-slate-500 text-sm leading-relaxed">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

function SidebarItem({ active, onClick, icon, label, collapsed }: { 
  active: boolean, 
  onClick: () => void, 
  icon: React.ReactNode, 
  label: string,
  collapsed: boolean
}) {
  return (
    <div className="relative group">
      <button 
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
          active ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-500 hover:bg-slate-50",
          collapsed ? "justify-center px-0" : ""
        )}
      >
        <div className={cn("flex-shrink-0", active ? "text-indigo-600" : "text-slate-400")}>
          {icon}
        </div>
        {!collapsed && <span className="whitespace-nowrap">{label}</span>}
      </button>
      
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100] shadow-xl">
          {label}
        </div>
      )}
    </div>
  );
}

function isValidDate(dateStr: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d instanceof Date && !isNaN(d.getTime());
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scope' | 'mapping' | 'pdca'>('scope');
  const [activeView, setActiveView] = useState<'kanban' | 'settings' | 'dashboard' | 'actions' | 'home'>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [operationalActions, setOperationalActions] = useState<OperationalAction[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [globalConfig, setGlobalConfig] = useState<{ sectors: string[], tools: string[] }>({ sectors: [], tools: [] });
  const [bpmnSavedColors, setBpmnSavedColors] = useState<SavedColor[]>([]);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      // Sempre que o usuário logar ou o sistema for recarregado com um usuário ativo, 
      // garantimos que a tela inicial seja a 'home' com a logo.
      if (firebaseUser) {
        setActiveView('home');
        setSelectedProjectId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Data Listeners
  useEffect(() => {
    if (!user) return;

    // Listen for Users
    const usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as User);
      setUsers(usersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    // Listen for Projects
    const projectsUnsubscribe = onSnapshot(collection(db, 'projects'), (snapshot) => {
      const projectsData = snapshot.docs.map(doc => doc.data() as Project);
      setProjects(projectsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'projects'));

    // Listen for Global Config
    const configUnsubscribe = onSnapshot(doc(db, 'config', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setGlobalConfig(snapshot.data() as any);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'config/global'));

    // Listen for Operational Actions
    const actionsUnsubscribe = onSnapshot(collection(db, 'operationalActions'), (snapshot) => {
      const actionsData = snapshot.docs.map(doc => doc.data() as OperationalAction);
      setOperationalActions(actionsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'operationalActions'));

    // Listen for Global BPMN Colors
    const colorsUnsubscribe = onSnapshot(collection(db, 'bpmnSavedColors'), (snapshot) => {
      const colorsData = snapshot.docs.map(doc => doc.data() as SavedColor);
      setBpmnSavedColors(colorsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'bpmnSavedColors'));

    return () => {
      usersUnsubscribe();
      projectsUnsubscribe();
      configUnsubscribe();
      actionsUnsubscribe();
      colorsUnsubscribe();
    };
  }, [user]);

  // Sync User Profile to Firestore
  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      setDoc(userDocRef, {
        id: user.uid,
        name: user.displayName || 'Usuário sem nome',
        email: user.email || '',
      }, { merge: true }).catch(error => handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`));
    }
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert(`Erro de Domínio: O domínio atual não está autorizado no Firebase. Adicione "${window.location.hostname}" na lista de domínios autorizados do Console do Firebase.`);
      } else if (error.code === 'auth/popup-blocked') {
        alert('O pop-up de login foi bloqueado pelo seu navegador. Por favor, permita pop-ups para este site.');
      } else {
        alert(`Falha no login: ${error.message}`);
      }
    }
  };

  const handleLogout = () => auth.signOut();

  const updateProjectInFirestore = async (updatedProjects: Project[] | ((prev: Project[]) => Project[])) => {
    // If it's a function, we need to get the current state
    let newProjects: Project[];
    if (typeof updatedProjects === 'function') {
      newProjects = updatedProjects(projects);
    } else {
      newProjects = updatedProjects;
    }

    // Find which project changed (assuming only one changes at a time for simplicity)
    // In a real app, you'd pass the specific project to update
    // For now, let's just update the local state and the Firestore will sync back via onSnapshot
    // But we need to actually write to Firestore here
    setProjects(newProjects);
  };

  const [isSaving, setIsSaving] = useState(false);

  // Improved update function for child components
  const syncProjectToFirestore = async (projectToSync: Project) => {
    // Recalculate status automatically
    const updatedProject = {
      ...projectToSync,
      status: calculateProjectStatus(projectToSync)
    };

    // Update local state immediately for UI responsiveness
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    
    // Persist to Firestore
    try {
      const projectRef = doc(db, 'projects', updatedProject.id);
      await setDoc(projectRef, updatedProject);
    } catch (error) {
      console.error("Auto-save failed:", error);
    }
  };

  const handleManualSave = async (projectToSave: Project) => {
    setIsSaving(true);
    try {
      console.log("⏳ Iniciando salvamento MANUAL no Firestore para o projeto:", projectToSave.id);
      const projectRef = doc(db, 'projects', projectToSave.id);
      
      // Ensure date is valid ISO string for security rules
      // Recalculate status automatically
      const finalProject = {
        ...projectToSave,
        status: calculateProjectStatus(projectToSave),
        createdAt: isValidDate(projectToSave.createdAt) 
          ? projectToSave.createdAt 
          : new Date().toISOString(),
        scope: {
          ...projectToSave.scope,
          startDate: isValidDate(projectToSave.scope.startDate) 
            ? projectToSave.scope.startDate 
            : new Date().toISOString().split('T')[0],
          forecastCompletion: isValidDate(projectToSave.scope.forecastCompletion) 
            ? projectToSave.scope.forecastCompletion 
            : new Date().toISOString().split('T')[0]
        }
      };

      await setDoc(projectRef, finalProject);
      console.log("✅ Projeto salvo com sucesso!");
    } catch (error: any) {
      console.error("❌ Erro ao salvar no Firestore:", error);
      if (error.message?.includes('offline') || error.message?.includes('not found')) {
        console.error("DICA: Verifique se o banco de dados '" + (dbId || '(default)') + "' existe no seu console Firebase.");
      }
      handleFirestoreError(error, OperationType.WRITE, `projects/${projectToSave.id}`);
    } finally {
      setTimeout(() => setIsSaving(false), 1000);
    }
  };

  const handleSaveGlobalColor = async (color: SavedColor) => {
    try {
      await setDoc(doc(db, 'bpmnSavedColors', color.id), color);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bpmnSavedColors/${color.id}`);
    }
  };

  const handleDeleteGlobalColor = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bpmnSavedColors', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bpmnSavedColors/${id}`);
    }
  };

  const handleDeleteProject = async (id: string) => {
    console.log('🗑️ [App] Iniciando exclusão do projeto:', id);
    
    try {
      const projectRef = doc(db, 'projects', id);
      console.log('📡 [App] Chamando deleteDoc para:', projectRef.path);
      await deleteDoc(projectRef);
      
      // Update local state immediately
      setProjects(prev => {
        const filtered = prev.filter(p => p.id !== id);
        console.log(`✅ [App] Estado local atualizado. De ${prev.length} para ${filtered.length} projetos.`);
        return filtered;
      });
      
      console.log('✅ [App] Projeto excluído com sucesso do Firestore.');
    } catch (error: any) {
      console.error('❌ [App] Erro crítico ao excluir projeto:', error);
      
      try {
        handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
      } catch (e) {
        // Ignore
      }
    }
  };

  const handleCreateProject = async (data: { name: string, priority: ProjectPriority, assignedTo: string }) => {
    if (!user) return;
    const newId = uuidv4();
    const assignedUser = users.find(u => u.id === data.assignedTo);
    
    const newProject: Project = {
      id: newId,
      name: data.name,
      createdAt: new Date().toISOString(),
      progress: 0,
      status: 'Planejamento',
      priority: data.priority,
      assignedTo: data.assignedTo,
      scope: {
        title: data.name,
        responsible: assignedUser?.name || 'Admin',
        problemDescription: '',
        measurableObjective: '',
        involvedSectors: [],
        toolsUsed: [],
        startDate: new Date().toISOString().split('T')[0],
        forecastCompletion: new Date().toISOString().split('T')[0],
        presentationLink: '',
        ods: '',
        esgEnvironmental: '',
        esgSocial: '',
        esgGovernance: '',
        financial: {
          currentImpact: { value: 0, type: 'continuo', period: 'mensal' },
          gainProjection: { value: 0, type: 'fixo', period: 'mensal' }
        }
      },
      subtasks: []
    };

    try {
      await setDoc(doc(db, 'projects', newId), newProject);
      setIsCreateModalOpen(false);
      setSelectedProjectId(newId);
      setActiveTab('scope');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${newId}`);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const handleProjectClick = (id: string) => {
    setSelectedProjectId(id);
    setActiveTab('scope');
  };

  const handleBackToKanban = () => {
    setSelectedProjectId(null);
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="text-indigo-600 animate-spin" size={40} />
          <p className="text-slate-500 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-8 border border-slate-100">
          <div className="w-auto h-12 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-slate-200 p-2 border border-slate-100">
            <img 
              src="/assets/logo-flowprocess.svg" 
              alt="FlowProcess" 
              style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-[#003489] tracking-tight">FlowProcess</h2>
            <p className="text-slate-500 text-sm">Gestão de Processos, BPMN e PDCA.</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-2xl font-bold hover:bg-slate-50 hover:border-indigo-200 transition-all group"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Entrar com Google
          </button>
          <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Acesso Seguro via Firebase</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
        {/* Sidebar */}
        <aside className={cn(
          "fixed left-0 top-0 h-full bg-white border-r border-slate-200 z-50 hidden lg:flex flex-col transition-all duration-300",
          isSidebarCollapsed ? "w-20" : "w-64"
        )}>
          <div className="p-4 border-b border-slate-100 flex flex-col items-center gap-4 shrink-0">
            <div className="flex items-center justify-between w-full min-w-0">
              <div className={cn("flex items-center gap-3 overflow-hidden transition-all duration-300", isSidebarCollapsed ? "w-0 opacity-0" : "w-auto opacity-100 min-w-0 flex-1")}>
                <div className="w-auto h-10 bg-white rounded-xl flex items-center justify-center shadow-md border border-slate-100 p-1 flex-shrink-0">
                  <img 
                    src="/assets/logo-flowprocess.svg" 
                    alt="Logo" 
                    style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h1 className="font-bold text-lg tracking-tight text-[#003489] whitespace-nowrap truncate">FlowProcess</h1>
              </div>
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className={cn("p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all shrink-0", isSidebarCollapsed && "mx-auto")}
                title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
              >
                <ChevronRight size={20} className={cn("transition-transform duration-300", !isSidebarCollapsed && "rotate-180")} />
              </button>
            </div>
            
            {isSidebarCollapsed && (
              <div className="w-auto h-10 bg-white rounded-xl flex items-center justify-center shadow-md border border-slate-100 p-1 shrink-0">
                <img 
                  src="/assets/logo-flowprocess.svg" 
                  alt="Logo" 
                  style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
            <SidebarItem 
              active={activeView === 'dashboard'}
              onClick={() => {
                setActiveView('dashboard');
                setSelectedProjectId(null);
              }}
              icon={<LayoutDashboard size={20} />}
              label="Dashboard"
              collapsed={isSidebarCollapsed}
            />
            <SidebarItem 
              active={activeView === 'kanban'}
              onClick={() => {
                setActiveView('kanban');
                setSelectedProjectId(null);
              }}
              icon={<GitBranch size={20} />}
              label="Projetos"
              collapsed={isSidebarCollapsed}
            />
            <SidebarItem 
              active={activeView === 'actions'}
              onClick={() => {
                setActiveView('actions');
                setSelectedProjectId(null);
              }}
              icon={<History size={20} />}
              label="Histórico de Ações"
              collapsed={isSidebarCollapsed}
            />
            <SidebarItem 
              active={activeView === 'settings'}
              onClick={() => setActiveView('settings')}
              icon={<Settings size={20} />}
              label="Configurações"
              collapsed={isSidebarCollapsed}
            />
          </nav>

          <div className="p-4 border-t border-slate-100">
            <div className={cn("flex items-center gap-3 px-4 py-3 transition-all duration-300 min-w-0 w-full", isSidebarCollapsed ? "justify-center" : "")}>
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="User" />
              </div>
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-semibold text-slate-800 truncate select-none">{user.displayName}</p>
                  <p className="text-xs text-slate-500 truncate select-none">{user.email}</p>
                </div>
              )}
              {!isSidebarCollapsed && (
                <LogOut 
                  size={18} 
                  className="text-slate-400 hover:text-red-500 cursor-pointer shrink-0" 
                  onClick={handleLogout}
                />
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className={cn(
          "transition-all duration-300 min-h-screen flex flex-col",
          isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64",
          "p-4 lg:p-8"
        )}>
          <AnimatePresence mode="wait">
            {activeView === 'home' ? (
              <motion.div 
                key="home"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="flex-1 flex flex-col items-center justify-center"
              >
                 <div className="flex flex-col items-center gap-8 text-center animate-in fade-in zoom-in duration-700">
                    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-100/40 border border-slate-100">
                       <img 
                         src="/assets/logo-flowprocess.svg" 
                         alt="Logo" 
                         className="h-32 w-auto object-contain"
                         referrerPolicy="no-referrer"
                       />
                    </div>
                    <div className="space-y-4">
                      <h2 className="text-5xl font-black text-[#003489] tracking-tighter" translate="no">FlowProcess</h2>
                      <div className="h-1.5 w-24 bg-indigo-600 mx-auto rounded-full" />
                      <p className="text-slate-400 text-lg font-medium tracking-wide">Gestão Inteligente de Processos</p>
                    </div>
                 </div>
              </motion.div>
            ) : activeView === 'settings' ? (
              <SettingsView 
                key="settings" 
                users={users} 
                globalConfig={globalConfig} 
                projects={projects}
                actions={operationalActions}
              />
            ) : activeView === 'dashboard' ? (
              <DashboardView 
                key="dashboard" 
                projects={projects} 
                users={users} 
                actions={operationalActions}
                onProjectClick={handleProjectClick} 
              />
            ) : activeView === 'actions' ? (
              <OperationalActionsTab 
                key="actions"
                actions={operationalActions}
                projects={projects}
                users={users}
              />
            ) : !selectedProjectId ? (
              <KanbanView 
                key="kanban"
                projects={projects} 
                users={users} 
                onProjectClick={handleProjectClick} 
                onCreateProject={() => setIsCreateModalOpen(true)}
                onDeleteProject={handleDeleteProject}
              />
            ) : selectedProject ? (
              <ProjectDetailView 
                key="detail"
                project={selectedProject} 
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onBack={handleBackToKanban}
                setProjects={syncProjectToFirestore as any}
                onSave={handleManualSave}
                isSaving={isSaving}
                users={users}
                globalConfig={globalConfig}
                savedColors={bpmnSavedColors}
                onSaveGlobalColor={handleSaveGlobalColor}
                onDeleteGlobalColor={handleDeleteGlobalColor}
              />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <RefreshCw className="text-indigo-600 animate-spin" size={32} />
                <p className="text-slate-500">Carregando projeto...</p>
                <button 
                  onClick={handleBackToKanban}
                  className="text-indigo-600 font-bold hover:underline"
                >
                  Voltar para o Kanban
                </button>
              </div>
            )}
          </AnimatePresence>
        </main>

        <CreateProjectModal 
          isOpen={isCreateModalOpen} 
          onClose={() => setIsCreateModalOpen(false)} 
          onCreate={handleCreateProject}
          users={users}
        />
      </div>
    </ErrorBoundary>
  );
}

// --- KANBAN VIEW ---

function KanbanView({ projects, users, onProjectClick, onCreateProject, onDeleteProject }: { 
  projects: Project[], 
  users: User[], 
  onProjectClick: (id: string) => void,
  onCreateProject: () => void,
  onDeleteProject: (id: string) => void,
  key?: string
}) {
  const [groupBy, setGroupBy] = useState<'status' | 'collaborator'>('status');
  const [visibleStatuses, setVisibleStatuses] = useState<ProjectStatus[]>(['Planejamento', 'Em andamento', 'Em melhoria', 'Concluído']);
  const [visibleCollaborators, setVisibleCollaborators] = useState<string[]>(users.map(u => u.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const statuses: ProjectStatus[] = ['Planejamento', 'Em andamento', 'Em melhoria', 'Concluído'];

  // Update visible collaborators when users list changes
  useEffect(() => {
    if (visibleCollaborators.length === 0 && users.length > 0) {
      setVisibleCollaborators(users.map(u => u.id));
    }
  }, [users]);

  const toggleStatus = (status: ProjectStatus) => {
    setVisibleStatuses(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleCollaborator = (userId: string) => {
    setVisibleCollaborators(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const filteredProjects = projects.map(p => ({ ...p, progress: calculateProjectProgress(p) })).filter(p => 
    visibleStatuses.includes(p.status) && 
    visibleCollaborators.includes(p.assignedTo) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     p.scope.responsible.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeFiltersCount = (statuses.length - visibleStatuses.length) + (users.length - visibleCollaborators.length);

  const columns = groupBy === 'status' 
    ? statuses.filter(s => visibleStatuses.includes(s))
    : users.filter(u => visibleCollaborators.includes(u.id));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Projetos</h2>
          <p className="text-slate-500 mt-1">
            Visualizando por {groupBy === 'status' ? 'status' : 'colaborador'}.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar projeto ou responsável..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm"
            />
          </div>

          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setGroupBy('status')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                groupBy === 'status' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <Target size={16} />
              Status
            </button>
            <button 
              onClick={() => setGroupBy('collaborator')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                groupBy === 'collaborator' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <Users size={16} />
              Colaborador
            </button>
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all border shadow-sm relative",
                isFilterOpen || activeFiltersCount > 0 ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              <Filter size={18} />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-indigo-600 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-black">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown size={16} className={cn("transition-transform", isFilterOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 p-5 space-y-6"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Filtrar Status</h4>
                      <div className="flex gap-2">
                        <button onClick={() => setVisibleStatuses(statuses)} className="text-[9px] font-bold text-indigo-600 hover:underline">Todos</button>
                        <button onClick={() => setVisibleStatuses([])} className="text-[9px] font-bold text-slate-400 hover:underline">Nenhum</button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {statuses.map(s => (
                        <button 
                          key={s}
                          onClick={() => toggleStatus(s)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
                            visibleStatuses.includes(s) 
                              ? "bg-indigo-50 border-indigo-200 text-indigo-600" 
                              : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Filtrar Colaboradores</h4>
                      <div className="flex gap-2">
                        <button onClick={() => setVisibleCollaborators(users.map(u => u.id))} className="text-[9px] font-bold text-indigo-600 hover:underline">Todos</button>
                        <button onClick={() => setVisibleCollaborators([])} className="text-[9px] font-bold text-slate-400 hover:underline">Nenhum</button>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {users.map(u => (
                        <button 
                          key={u.id}
                          onClick={() => toggleCollaborator(u.id)}
                          className={cn(
                            "w-full flex items-center gap-3 p-2 rounded-xl border transition-all text-left",
                            visibleCollaborators.includes(u.id)
                              ? "bg-indigo-50 border-indigo-200"
                              : "bg-white border-slate-100 hover:border-slate-200"
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold uppercase",
                            visibleCollaborators.includes(u.id) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                          )}>
                            {u.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className={cn(
                            "text-xs font-bold truncate",
                            visibleCollaborators.includes(u.id) ? "text-indigo-600" : "text-slate-500"
                          )}>{u.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-between">
                    <button 
                      onClick={() => {
                        setVisibleStatuses(statuses);
                        setVisibleCollaborators(users.map(u => u.id));
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:underline"
                    >
                      Limpar Filtros
                    </button>
                    <button 
                      onClick={() => setIsFilterOpen(false)}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                    >
                      Fechar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={onCreateProject}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus size={20} />
            <span>Novo Projeto</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 overflow-x-auto pb-4 min-h-[600px] custom-scrollbar">
        {columns.map(col => {
          const colId = typeof col === 'string' ? col : col.id;
          const colTitle = typeof col === 'string' ? col : col.name;
          const colProjects = filteredProjects.filter(p => 
            groupBy === 'status' ? p.status === colId : p.assignedTo === colId
          );

          return (
            <div key={colId} className="flex flex-col gap-4 min-w-[320px] flex-1">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  {groupBy === 'status' ? (
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      colId === 'Planejamento' ? "bg-amber-400" :
                      colId === 'Em andamento' ? "bg-blue-400" :
                      colId === 'Em melhoria' ? "bg-indigo-400" : "bg-emerald-400"
                    )} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
                      {(col as User).name.split(' ').map(n => n[0]).join('')}
                    </div>
                  )}
                  <h3 className="font-bold text-slate-700">{colTitle}</h3>
                  <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                    {colProjects.length}
                  </span>
                </div>
              </div>

              <div className="bg-slate-100/50 p-3 rounded-2xl flex-1 space-y-4 border border-slate-200/50">
                {colProjects.map(project => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                    users={users}
                    onClick={() => onProjectClick(project.id)} 
                    onDelete={() => onDeleteProject(project.id)}
                  />
                ))}
                
                {colProjects.length === 0 && (
                  <div className="py-10 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-xl">
                    <Target size={24} className="mb-2 opacity-20" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Vazio</p>
                  </div>
                )}

                {(groupBy === 'status' && colId === 'Planejamento') && (
                  <button 
                    onClick={onCreateProject}
                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 hover:border-indigo-300 hover:text-indigo-400 transition-all flex items-center justify-center gap-2 group"
                  >
                    <Plus size={18} className="group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-medium">Adicionar Projeto</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function ProjectCard({ project, users, onClick, onDelete }: { project: Project, users: User[], onClick: () => void, onDelete: () => void, key?: string }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const assignedUser = users.find(u => u.id === project.assignedTo);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setShowConfirm(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const statusColors = {
    'Planejamento': 'bg-amber-100 text-amber-700 border-amber-200',
    'Em andamento': 'bg-blue-100 text-blue-700 border-blue-200',
    'Em melhoria': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'Concluído': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  const priorityColors = {
    'Baixa': 'bg-slate-100 text-slate-600',
    'Média': 'bg-indigo-100 text-indigo-600',
    'Alta': 'bg-rose-100 text-rose-600',
  };

  return (
    <motion.div 
      whileHover={{ y: -4, shadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
      className="bg-white p-5 rounded-xl border border-slate-200 cursor-pointer transition-all relative group"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-wrap gap-2">
          <span className={cn(
            "text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md border",
            statusColors[project.status]
          )}>
            {project.status}
          </span>
          <span className={cn(
            "text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md",
            priorityColors[project.priority || 'Baixa']
          )}>
            {project.priority || 'Baixa'}
          </span>
        </div>
        <div className="relative" ref={menuRef}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className="text-slate-300 hover:text-slate-500 p-1 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <MoreVertical size={16} />
          </button>
          
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
              {!showConfirm ? (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('🖱️ [ProjectCard] Clique em "Excluir Projeto"');
                    setShowConfirm(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Excluir Projeto</span>
                </button>
              ) : (
                <div className="p-3 space-y-3 bg-rose-50">
                  <p className="text-xs font-bold text-rose-600 text-center">Confirmar exclusão?</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('🔥 [ProjectCard] Confirmado! Chamando onDelete()');
                        onDelete();
                        setIsMenuOpen(false);
                        setShowConfirm(false);
                      }}
                      className="flex-1 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors"
                    >
                      Sim
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowConfirm(false);
                      }}
                      className="flex-1 py-2 bg-white text-slate-600 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      Não
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <h4 className="font-bold text-slate-800 leading-tight mb-4 group-hover:text-indigo-600 transition-colors">
        {project.name}
      </h4>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="text-indigo-500" />
            <div className="flex flex-col">
              <span className="text-[8px] uppercase font-bold text-slate-400">Início</span>
              <span>{isValidDate(project.scope.startDate) ? format(new Date(project.scope.startDate), 'dd/MM/yyyy') : 'N/A'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-emerald-500" />
            <div className="flex flex-col">
              <span className="text-[8px] uppercase font-bold text-slate-400">Previsão</span>
              <span>{isValidDate(project.scope.forecastCompletion) ? format(new Date(project.scope.forecastCompletion), 'dd/MM/yyyy') : 'N/A'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            <span>{project.progress}%</span>
          </div>
          {assignedUser && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
              <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[8px] font-bold uppercase">
                {assignedUser.name.split(' ').map(n => n[0]).join('')}
              </div>
              <span className="text-[9px] font-medium truncate max-w-[60px]">{assignedUser.name.split(' ')[0]}</span>
            </div>
          )}
        </div>

        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${project.progress}%` }}
            className={cn(
              "h-full rounded-full",
              project.progress > 70 ? "bg-emerald-500" : project.progress > 30 ? "bg-indigo-500" : "bg-amber-500"
            )}
          />
        </div>
      </div>
    </motion.div>
  );
}

// --- PROJECT DETAIL VIEW ---

function ProjectDetailView({ 
  project, 
  activeTab, 
  setActiveTab, 
  onBack, 
  setProjects, 
  onSave, 
  isSaving, 
  users, 
  globalConfig,
  savedColors,
  onSaveGlobalColor,
  onDeleteGlobalColor
}: { 
  project: Project, 
  activeTab: string, 
  setActiveTab: (tab: any) => void,
  onBack: () => void,
  setProjects: (p: Project) => void,
  onSave: (p: Project) => void,
  isSaving: boolean,
  users: User[],
  globalConfig: { sectors: string[], tools: string[] },
  savedColors: SavedColor[],
  onSaveGlobalColor: (color: SavedColor) => void,
  onDeleteGlobalColor: (id: string) => void,
  key?: string
}) {
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(null);

  const selectedSubtask = project.subtasks?.find(s => s.id === selectedSubtaskId);

  const handleUpdateSubtask = (updatedSubtask: Subtask) => {
    const updatedSubtasks = (project.subtasks || []).map(s => s.id === updatedSubtask.id ? updatedSubtask : s);
    setProjects({ ...project, subtasks: updatedSubtasks });
  };

  // If a subtask is selected, we show the "Execution" view (Mapping + PDCA)
  if (selectedSubtaskId && selectedSubtask) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col h-full bg-slate-50"
      >
        {/* Subtask Header */}
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setSelectedSubtaskId(null);
                setActiveTab('scope');
              }}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 flex items-center gap-2 font-bold text-sm"
            >
              <ChevronRight size={20} className="rotate-180" />
              Voltar ao Escopo
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Execução: {selectedSubtask.title}
              </h3>
              <p className="text-xs text-slate-500 font-medium">Projeto: {project.scope.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <TabButton 
                active={activeTab === 'mapping'} 
                onClick={() => setActiveTab('mapping')} 
                icon={<GitBranch size={16} />} 
                label="Mapeamento" 
              />
              <TabButton 
                active={activeTab === 'pdca'} 
                onClick={() => setActiveTab('pdca')} 
                icon={<RefreshCw size={16} />} 
                label="PDCA" 
              />
            </div>
            <button 
              onClick={() => onSave(project)}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              <Save size={18} />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'mapping' && (
            <MappingTab 
              project={project} 
              subtask={selectedSubtask} 
              onUpdateSubtask={handleUpdateSubtask}
              savedColors={savedColors}
              onSaveGlobalColor={onSaveGlobalColor}
              onDeleteGlobalColor={onDeleteGlobalColor}
            />
          )}
          {activeTab === 'pdca' && (
            <PDCAEditor 
              project={project} 
              subtask={selectedSubtask}
              onUpdateSubtask={handleUpdateSubtask}
              onBack={() => {
                setSelectedSubtaskId(null);
                setActiveTab('scope');
              }}
              defaultTaskId={selectedSubtaskId} 
            />
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <ChevronRight size={24} className="rotate-180" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <input 
                value={project.name}
                onChange={(e) => setProjects({ 
                  ...project, 
                  name: e.target.value,
                  scope: { ...project.scope, title: e.target.value }
                })}
                className="text-2xl font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none transition-all"
              />
              {isSaving && (
                <span className="flex items-center gap-1.5 text-[10px] font-black text-indigo-500 uppercase tracking-widest animate-pulse">
                  <RefreshCw size={10} className="animate-spin" />
                  Salvando...
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Users size={14} />
                {project.scope.responsible}
              </span>
              <span className="w-1 h-1 bg-slate-300 rounded-full" />
              <span className="flex items-center gap-1">
                <Clock size={14} />
                Iniciado em {isValidDate(project.createdAt) ? format(new Date(project.createdAt), 'dd/MM/yyyy') : 'Data Inválida'}
              </span>
              <span className="w-1 h-1 bg-slate-300 rounded-full" />
              <select 
                value={project.priority || 'Média'}
                onChange={(e) => setProjects({ ...project, priority: e.target.value as ProjectPriority })}
                className={cn(
                  "text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border outline-none transition-all",
                  project.priority === 'Alta' ? "bg-rose-50 text-rose-600 border-rose-100" :
                  project.priority === 'Média' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                  "bg-slate-50 text-slate-600 border-slate-100"
                )}
              >
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Progresso</span>
              <span className="text-lg font-black text-indigo-600">{calculateProjectProgress(project)}%</span>
            </div>
            <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${calculateProjectProgress(project)}%` }}
                className="h-full bg-indigo-600 rounded-full"
              />
            </div>
          </div>
          <button 
            onClick={() => onSave(project)}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[600px] overflow-hidden">
        {activeTab === 'scope' && (
          <ScopeTab 
            project={project} 
            setProjects={setProjects} 
            users={users} 
            globalConfig={globalConfig} 
            onSelectSubtask={(taskId) => {
              setSelectedSubtaskId(taskId);
              setActiveTab('mapping');
            }}
          />
        )}
      </div>
    </motion.div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-bold text-xs uppercase tracking-wider",
        active 
          ? "bg-white text-indigo-600 shadow-sm" 
          : "text-slate-500 hover:bg-white/50 hover:text-slate-700"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// --- SCOPE TAB ---

function ScopeTab({ 
  project, 
  setProjects, 
  users, 
  globalConfig,
  onSelectSubtask
}: { 
  project: Project, 
  setProjects: (p: Project) => void, 
  users: User[], 
  globalConfig: { sectors: string[], tools: string[] },
  onSelectSubtask: (taskId: string) => void
}) {
  const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
  const [newSubtaskData, setNewSubtaskData] = useState({
    title: '',
    priority: 'Média' as ProjectPriority,
    status: 'Pendente' as any,
    responsibleId: ''
  });

  const updateScope = (field: string, value: any) => {
    const updatedProject = { ...project, scope: { ...project.scope, [field]: value } };
    if (field === 'title') {
      updatedProject.name = value;
    }
    setProjects(updatedProject);
  };

  const handleReassign = (userId: string) => {
    const selectedUser = users.find(u => u.id === userId);
    if (selectedUser) {
      setProjects({ 
        ...project, 
        assignedTo: userId,
        scope: { ...project.scope, responsible: selectedUser.name }
      });
    }
  };

  const addSubtask = () => {
    if (!newSubtaskData.title) {
      alert('Por favor, informe o título da subtarefa.');
      return;
    }

    const newSubtask: Subtask = {
      id: uuidv4(),
      title: newSubtaskData.title,
      priority: newSubtaskData.priority,
      status: newSubtaskData.status,
      responsibleId: newSubtaskData.responsibleId,
      mapping: {
        nodes: [],
        edges: [],
        orientation: 'horizontal',
        lastEdited: new Date().toISOString(),
        savedColors: []
      },
      pdcaCycles: []
    };
    setProjects({ ...project, subtasks: [...(project.subtasks || []), newSubtask] });
    setIsSubtaskModalOpen(false);
    setNewSubtaskData({
      title: '',
      priority: 'Média',
      status: 'Pendente',
      responsibleId: ''
    });
  };

  const updateSubtask = (id: string, field: keyof Subtask, value: any) => {
    const updatedSubtasks = (project.subtasks || []).map(s => 
      s.id === id ? { ...s, [field]: value } : s
    );
    setProjects({ ...project, subtasks: updatedSubtasks });
  };

  const deleteSubtask = (id: string) => {
    const updatedSubtasks = (project.subtasks || []).filter(s => s.id !== id);
    setProjects({ ...project, subtasks: updatedSubtasks });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-12">
      {/* 1. INFORMAÇÕES GERAIS */}
      <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
        <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <FileText size={20} />
          </div>
          Informações Gerais
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <FormField 
              label="Título do Projeto" 
              value={project.scope.title} 
              onChange={(v) => updateScope('title', v)}
            />
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Responsável</label>
              <select 
                value={project.assignedTo}
                onChange={(e) => handleReassign(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-sm"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <FormField 
                label="Link da apresentação do projeto" 
                value={project.scope.presentationLink || ''} 
                placeholder="Cole aqui o link da apresentação do projeto"
                onChange={(v) => updateScope('presentationLink', v)}
              />
              {project.scope.presentationLink && (
                <a 
                  href={project.scope.presentationLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors ml-1"
                >
                  <ExternalLink size={14} />
                  Abrir Apresentação
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. CONTEXTO DO PROJETO */}
      <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
        <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Target size={20} />
          </div>
          Contexto do Projeto
        </h3>
        <div className="space-y-8">
          <FormField 
            label="Descrição do Problema" 
            value={project.scope.problemDescription} 
            type="textarea" 
            placeholder="Descreva detalhadamente o problema que este projeto visa resolver..."
            onChange={(v) => updateScope('problemDescription', v)}
          />
          <FormField 
            label="Objetivo Mensurável" 
            value={project.scope.measurableObjective} 
            type="textarea"
            placeholder="Ex: Reduzir o tempo de processamento em 20% até o final do semestre..."
            onChange={(v) => updateScope('measurableObjective', v)}
          />
        </div>
      </section>

      {/* 3. ESTRUTURA DO PROJETO */}
      <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
        <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Briefcase size={20} />
          </div>
          Estrutura do Projeto
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-8">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-3 block ml-1">Setores Envolvidos</label>
              <div className="flex flex-wrap gap-2 mb-4">
                {project.scope.involvedSectors.map(s => (
                  <span key={s.id} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold border border-indigo-100 flex items-center gap-2">
                    {s.name}
                    <button 
                      onClick={() => updateScope('involvedSectors', project.scope.involvedSectors.filter(item => item.id !== s.id))}
                      className="hover:text-rose-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                onChange={(e) => {
                  const name = e.target.value;
                  if (name && !project.scope.involvedSectors.find(s => s.name === name)) {
                    updateScope('involvedSectors', [...project.scope.involvedSectors, { id: uuidv4(), name }]);
                  }
                  e.target.value = '';
                }}
              >
                <option value="">+ Adicionar Setor</option>
                {globalConfig.sectors.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-3 block ml-1">Ferramentas Utilizadas</label>
              <div className="flex flex-wrap gap-2 mb-4">
                {project.scope.toolsUsed.map(t => (
                  <span key={t.id} className="bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 flex items-center gap-2">
                    {t.name}
                    <button 
                      onClick={() => updateScope('toolsUsed', project.scope.toolsUsed.filter(item => item.id !== t.id))}
                      className="hover:text-rose-500 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <select 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                onChange={(e) => {
                  const name = e.target.value;
                  if (name && !project.scope.toolsUsed.find(t => t.name === name)) {
                    updateScope('toolsUsed', [...project.scope.toolsUsed, { id: uuidv4(), name }]);
                  }
                  e.target.value = '';
                }}
              >
                <option value="">+ Adicionar Ferramenta</option>
                {globalConfig.tools.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-8">
            <FormField 
              label="Data Início" 
              value={project.scope.startDate} 
              type="date" 
              onChange={(v) => updateScope('startDate', v)}
            />
            <FormField 
              label="Previsão Conclusão" 
              value={project.scope.forecastCompletion} 
              type="date" 
              onChange={(v) => updateScope('forecastCompletion', v)}
            />
          </div>
        </div>
      </section>

      {/* 4. ODS */}
      <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
        <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Globe size={20} />
          </div>
          ODS (Objetivos de Desenvolvimento Sustentável)
        </h3>
        <FormField 
          label="ODS Vinculadas" 
          value={project.scope.ods || ''} 
          type="textarea"
          placeholder="Exemplo:&#10;ODS 8 - Trabalho Decente e Crescimento Econômico: ...&#10;ODS 9 - Indústria, Inovação e Infraestrutura: ...&#10;ODS 12 - Consumo e Produção Responsáveis: ..."
          onChange={(v) => updateScope('ods', v)}
        />
      </section>

      {/* 5. ESG */}
      <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
        <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Leaf size={20} />
          </div>
          ESG (Environmental, Social and Governance)
        </h3>
        <div className="grid grid-cols-1 gap-8">
          <div className="flex gap-4 items-start">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-6">
              <Leaf size={24} />
            </div>
            <div className="flex-1">
              <FormField 
                label="E – Environmental" 
                value={project.scope.esgEnvironmental || ''} 
                type="textarea"
                placeholder="Descreva os impactos ambientais do projeto..."
                onChange={(v) => updateScope('esgEnvironmental', v)}
              />
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 mt-6">
              <Heart size={24} />
            </div>
            <div className="flex-1">
              <FormField 
                label="S – Social" 
                value={project.scope.esgSocial || ''} 
                type="textarea"
                placeholder="Ex: Qualidade de vida, bem-estar, impacto nos colaboradores..."
                onChange={(v) => updateScope('esgSocial', v)}
              />
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-6">
              <ShieldCheck size={24} />
            </div>
            <div className="flex-1">
              <FormField 
                label="G – Governance" 
                value={project.scope.esgGovernance || ''} 
                type="textarea"
                placeholder="Ex: Eficiência, conformidade, controles, governança..."
                onChange={(v) => updateScope('esgGovernance', v)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 6. SUBTAREFAS (LIST FORMAT) */}
      <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
            <div className="w-auto h-10 rounded-2xl bg-white border border-slate-100 p-1 flex items-center justify-center shadow-md">
              <img 
                src="/assets/logo-flowprocess.svg" 
                alt="Logo" 
                style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
                referrerPolicy="no-referrer"
              />
            </div>
            Subtarefas do Projeto
          </h3>
          <button 
            onClick={() => setIsSubtaskModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus size={18} />
            Nova Subtarefa
          </button>
        </div>

        <div className="overflow-hidden border border-slate-100 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Título da Subtarefa</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">Prioridade</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-48">Responsável</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(project.subtasks || []).map((subtask) => {
                const isReadOnly = subtask.status === 'Concluído';
                return (
                  <tr key={subtask.id} className={cn("group hover:bg-slate-50/50 transition-colors", isReadOnly && "bg-slate-50/30")}>
                    <td className="px-6 py-4">
                      <input 
                        value={subtask.title || ''}
                        onChange={(e) => updateSubtask(subtask.id, 'title', e.target.value)}
                        readOnly={isReadOnly}
                        className={cn(
                          "w-full bg-transparent font-bold text-slate-700 outline-none border-none p-0 transition-colors",
                          isReadOnly ? "text-slate-400 cursor-not-allowed" : "focus:text-indigo-600"
                        )}
                        placeholder="Título da subtarefa..."
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {subtask.pdcaCycles.length} Ciclos PDCA
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={subtask.priority || 'Média'}
                        onChange={(e) => updateSubtask(subtask.id, 'priority', e.target.value)}
                        disabled={isReadOnly}
                        className={cn(
                          "w-full px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider outline-none border-none cursor-pointer disabled:cursor-not-allowed",
                          subtask.priority === 'Alta' ? "bg-rose-100 text-rose-600" :
                          subtask.priority === 'Média' ? "bg-indigo-100 text-indigo-600" :
                          "bg-slate-200 text-slate-600"
                        )}
                      >
                        <option value="Alta">Alta</option>
                        <option value="Média">Média</option>
                        <option value="Baixa">Baixa</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={subtask.status || 'Pendente'}
                        onChange={(e) => updateSubtask(subtask.id, 'status', e.target.value)}
                        className={cn(
                          "w-full px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider outline-none border-none cursor-pointer",
                          subtask.status === 'Concluído' ? "bg-emerald-100 text-emerald-600" :
                          subtask.status === 'Em andamento' ? "bg-amber-100 text-amber-600" :
                          "bg-slate-200 text-slate-500"
                        )}
                      >
                        <option value="Pendente">Pendente</option>
                        <option value="Em andamento">Em andamento</option>
                        <option value="Concluído">Concluído</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={subtask.responsibleId || ''}
                        onChange={(e) => updateSubtask(subtask.id, 'responsibleId', e.target.value)}
                        disabled={isReadOnly}
                        className={cn(
                          "w-full px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider outline-none border border-slate-200 cursor-pointer disabled:cursor-not-allowed bg-white text-xs",
                          isReadOnly ? "opacity-50" : ""
                        )}
                      >
                        <option value="">Sem Responsável</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => onSelectSubtask(subtask.id)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Executar Mapeamento e PDCA"
                        >
                          <ArrowRight size={18} />
                        </button>
                        <button 
                          onClick={() => deleteSubtask(subtask.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title="Excluir Subtarefa"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(project.subtasks || []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-auto h-12 rounded-2xl bg-white border border-slate-100 p-2 flex items-center justify-center text-slate-300 shadow-sm">
                        <img 
                          src="/assets/logo-flowprocess.svg" 
                          alt="Logo" 
                          style={{ height: '36px', width: 'auto', objectFit: 'contain', opacity: 0.5 }}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <p className="font-bold text-slate-500">Nenhuma subtarefa definida</p>
                        <p className="text-xs text-slate-400 mt-1">Adicione os processos ou frentes de trabalho que compõem este projeto.</p>
                      </div>
                      <button 
                        onClick={() => setIsSubtaskModalOpen(true)}
                        className="mt-2 text-indigo-600 font-bold text-sm hover:underline"
                      >
                        + Adicionar primeira subtarefa
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL PARA NOVA SUBTAREFA */}
      <AnimatePresence>
        {isSubtaskModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSubtaskModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                    <Plus size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Nova Subtarefa</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Estrutura do Projeto</p>
                  </div>
                </div>
                <button onClick={() => setIsSubtaskModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-all text-slate-400">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Título da Subtarefa</label>
                  <input 
                    required
                    value={newSubtaskData.title}
                    onChange={(e) => setNewSubtaskData({ ...newSubtaskData, title: e.target.value })}
                    placeholder="Ex: Mapeamento de Processo RH"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Prioridade</label>
                    <select 
                      value={newSubtaskData.priority}
                      onChange={(e) => setNewSubtaskData({ ...newSubtaskData, priority: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Status Inicial</label>
                    <select 
                      value={newSubtaskData.status}
                      onChange={(e) => setNewSubtaskData({ ...newSubtaskData, status: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Em andamento">Em andamento</option>
                      <option value="Concluído">Concluído</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Responsável</label>
                  <select 
                    value={newSubtaskData.responsibleId}
                    onChange={(e) => setNewSubtaskData({ ...newSubtaskData, responsibleId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="">Selecionar Responsável</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setIsSubtaskModalOpen(false)}
                    className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={addSubtask}
                    className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg"
                  >
                    Criar subtarefa
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FormField({ 
  label, 
  value, 
  type = 'text', 
  readOnly = false, 
  placeholder,
  onChange 
}: { 
  label: string, 
  value: any, 
  type?: string, 
  readOnly?: boolean, 
  placeholder?: string,
  onChange?: (v: any) => void 
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">{label}</label>
      {readOnly ? (
        <div className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 cursor-not-allowed text-sm">
          {value || ''}
        </div>
      ) : type === 'textarea' ? (
        <textarea 
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full p-4 bg-white border border-slate-200 rounded-xl text-slate-700 min-h-[120px] outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm leading-relaxed"
        />
      ) : (
        <input 
          type={type}
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full p-4 bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
        />
      )}
    </div>
  );
}

// --- MODALS ---

function CreateProjectModal({ isOpen, onClose, onCreate, users }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onCreate: (data: { name: string, priority: ProjectPriority, assignedTo: string }) => void,
  users: User[]
}) {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('Média');
  const [assignedTo, setAssignedTo] = useState('');

  useEffect(() => {
    if (isOpen && users.length > 0 && !assignedTo) {
      setAssignedTo(users[0].id);
    }
  }, [isOpen, users, assignedTo]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold text-slate-900">Novo Projeto</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
              <Plus size={24} className="rotate-45" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">Título do Projeto</label>
              <input 
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Melhoria no Processo de Vendas"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">Prioridade</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Baixa', 'Média', 'Alta'] as ProjectPriority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      "py-2 rounded-xl text-xs font-bold border transition-all",
                      priority === p 
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" 
                        : "bg-white border-slate-200 text-slate-500 hover:border-indigo-200"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">Designar para</label>
              <select 
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            disabled={!name.trim()}
            onClick={() => onCreate({ name, priority, assignedTo })}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Criar Projeto
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- SETTINGS VIEW ---

function SettingsView({ users, globalConfig, projects, actions }: { 
  users: User[], 
  globalConfig: { sectors: string[], tools: string[] }, 
  projects: Project[],
  actions: OperationalAction[],
  key?: string 
}) {
  const [activeSubTab, setActiveSubTab] = useState<'perfil' | 'cadastros' | 'setores-ferramentas' | 'relatorios'>('cadastros');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8 max-w-5xl mx-auto"
    >
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Configurações</h2>
        <p className="text-slate-500 mt-1">Gerencie as preferências do sistema e cadastros.</p>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit overflow-x-auto max-w-full">
        <button 
          onClick={() => setActiveSubTab('cadastros')}
          className={cn(
            "px-6 py-2.5 rounded-xl transition-all font-medium text-sm flex items-center gap-2 shrink-0",
            activeSubTab === 'cadastros' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <Users size={18} />
          <span>Cadastros</span>
        </button>
        <button 
          onClick={() => setActiveSubTab('setores-ferramentas')}
          className={cn(
            "px-6 py-2.5 rounded-xl transition-all font-medium text-sm flex items-center gap-2 shrink-0",
            activeSubTab === 'setores-ferramentas' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <Settings size={18} />
          <span>Setores e Ferramentas</span>
        </button>
        <button 
          onClick={() => setActiveSubTab('relatorios')}
          className={cn(
            "px-6 py-2.5 rounded-xl transition-all font-medium text-sm flex items-center gap-2 shrink-0",
            activeSubTab === 'relatorios' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <FileText size={18} />
          <span>Relatórios</span>
        </button>
        <button 
          onClick={() => setActiveSubTab('perfil')}
          className={cn(
            "px-6 py-2.5 rounded-xl transition-all font-medium text-sm flex items-center gap-2 shrink-0",
            activeSubTab === 'perfil' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <UserIcon size={18} />
          <span>Meu Perfil</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
        {activeSubTab === 'cadastros' && <UserRegistrationTab users={users} />}
        {activeSubTab === 'setores-ferramentas' && <GlobalConfigTab config={globalConfig} />}
        {activeSubTab === 'relatorios' && <ReportsTab projects={projects} users={users} actions={actions} />}
        {activeSubTab === 'perfil' && (
          <div className="p-12 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto flex items-center justify-center text-slate-400">
              <Users size={40} />
            </div>
            <p className="text-slate-500">Configurações de perfil em desenvolvimento.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function GlobalConfigTab({ config }: { config: { sectors: string[], tools: string[] } }) {
  const [newSector, setNewSector] = useState('');
  const [newTool, setNewTool] = useState('');

  const updateConfig = async (updates: any) => {
    try {
      await setDoc(doc(db, 'config', 'global'), { ...config, ...updates }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'config/global');
    }
  };

  return (
    <div className="p-8 lg:p-12 space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Setores</h3>
            <p className="text-slate-500 text-sm mt-1">Gerencie os setores disponíveis para seleção.</p>
          </div>
          <div className="flex gap-2">
            <input 
              value={newSector}
              onChange={(e) => setNewSector(e.target.value)}
              placeholder="Novo setor..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button 
              onClick={() => {
                if (newSector && !config.sectors.includes(newSector)) {
                  updateConfig({ sectors: [...config.sectors, newSector] });
                  setNewSector('');
                }
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all"
            >
              Adicionar
            </button>
          </div>
          <div className="space-y-2">
            {config.sectors.map(s => (
              <div key={s} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-sm font-medium text-slate-700">{s}</span>
                <button 
                  onClick={() => updateConfig({ sectors: config.sectors.filter(item => item !== s) })}
                  className="text-slate-400 hover:text-rose-500 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Ferramentas</h3>
            <p className="text-slate-500 text-sm mt-1">Gerencie as ferramentas disponíveis para seleção.</p>
          </div>
          <div className="flex gap-2">
            <input 
              value={newTool}
              onChange={(e) => setNewTool(e.target.value)}
              placeholder="Nova ferramenta..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button 
              onClick={() => {
                if (newTool && !config.tools.includes(newTool)) {
                  updateConfig({ tools: [...config.tools, newTool] });
                  setNewTool('');
                }
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all"
            >
              Adicionar
            </button>
          </div>
          <div className="space-y-2">
            {config.tools.map(t => (
              <div key={t} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-sm font-medium text-slate-700">{t}</span>
                <button 
                  onClick={() => updateConfig({ tools: config.tools.filter(item => item !== t) })}
                  className="text-slate-400 hover:text-rose-500 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserRegistrationTab({ users }: { users: User[] }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sector, setSector] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingUser) {
      setName(editingUser.name);
      setEmail(editingUser.email || '');
      setSector(editingUser.sector || '');
    } else {
      setName('');
      setEmail('');
      setSector('');
    }
  }, [editingUser]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !sector) return;
    
    setIsSubmitting(true);
    try {
      const userId = editingUser ? editingUser.id : uuidv4();
      const userData: User = {
        id: userId,
        name,
        email,
        sector
      };

      await setDoc(doc(db, 'users', userId), userData, { merge: true });
      
      setName('');
      setEmail('');
      setSector('');
      setEditingUser(null);
      alert(editingUser ? 'Usuário atualizado com sucesso!' : 'Usuário cadastrado com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      alert('Usuário excluído com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    }
  };

  return (
    <div className="p-8 lg:p-12 space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {editingUser ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}
            </h3>
            <p className="text-slate-500 text-sm mt-1">
              {editingUser ? 'Atualize as informações do colaborador.' : 'Adicione colaboradores que terão acesso ao sistema.'}
            </p>
          </div>

          <form onSubmit={handleSaveUser} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">Nome do Colaborador</label>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">E-mail</label>
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@empresa.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">Setor</label>
              <input 
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Ex: Qualidade, Produção, RH"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div className="flex gap-3">
              <button 
                type="submit"
                disabled={isSubmitting || !name || !email || !sector}
                className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                {isSubmitting ? 'Salvando...' : editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}
              </button>
              {editingUser && (
                <button 
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-6 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Usuários Cadastrados</h3>
            <p className="text-slate-500 text-sm mt-1">Lista de colaboradores com acesso.</p>
          </div>

          <div className="space-y-3">
            {users.length === 0 ? (
              <p className="text-slate-400 text-sm italic">Nenhum usuário cadastrado.</p>
            ) : (
              users.map(u => (
                <div key={u.id} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50/50 group">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    {u.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{u.name}</p>
                    <p className="text-[10px] text-slate-500 truncate uppercase tracking-wider font-medium">{u.sector || 'Setor não informado'}</p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => setEditingUser(u)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="Editar"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(u.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PDCATab({ 
  project, 
  subtask, 
  onUpdateSubtask,
  selectedTaskId 
}: { 
  project: Project, 
  subtask: Subtask,
  onUpdateSubtask: (s: Subtask) => void,
  selectedTaskId?: string | null 
}) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const filteredCycles = selectedTaskId 
    ? subtask.pdcaCycles.filter(c => c.taskId === selectedTaskId)
    : subtask.pdcaCycles;

  if (isEditorOpen) {
    return (
      <div className="fixed inset-0 z-[100] bg-white">
        <PDCAEditor 
          project={project} 
          subtask={subtask}
          onUpdateSubtask={onUpdateSubtask}
          onBack={() => setIsEditorOpen(false)} 
          defaultTaskId={selectedTaskId || undefined}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Ciclos PDCA</h3>
          <p className="text-slate-500">Gerencie a melhoria contínua baseada nos problemas identificados no mapeamento.</p>
        </div>
        <button 
          onClick={() => setIsEditorOpen(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
        >
          <RefreshCw size={20} />
          <span>Abrir Editor PDCA</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredCycles.length === 0 ? (
          <div className="py-20 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400">
            <RefreshCw size={48} className="mb-4 opacity-20" />
            <p className="font-medium">Nenhum ciclo PDCA iniciado para esta etapa.</p>
            <p className="text-sm">Inicie um novo ciclo para resolver os problemas identificados.</p>
          </div>
        ) : (
          filteredCycles.map(cycle => (
            <div 
              key={cycle.id} 
              onClick={() => setIsEditorOpen(true)}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{cycle.title}</h4>
                  <p className="text-sm text-slate-500 mt-1">Iniciado em {format(new Date(cycle.createdAt), 'dd/MM/yyyy')}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                    Ativo
                  </span>
                  <div className="flex items-center gap-1 text-slate-400">
                    <ArrowRight size={16} />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
