import React, { useState, useEffect, useLayoutEffect, Component, useRef } from 'react';
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
  Layers,
  Users,
  User as UserIcon,
  FileText,
  Settings,
  LogOut,
  ArrowRight,
  Save,
  Trash2,
  Edit,
  Edit2,
  Filter,
  ChevronDown,
  X,
  Check,
  Activity,
  ExternalLink,
  Globe,
  TrendingUp,
  Zap,
  Award,
  CheckCircle,
  XCircle,
  Leaf,
  Heart,
  ShieldCheck,
  Briefcase,
  History,
  Download,
  Sun,
  Moon,
  Menu,
  Lock,
  Eye,
  EyeOff
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
import { 
  Project, 
  ProjectStatus, 
  ProjectPriority, 
  User, 
  Subtask, 
  OperationalAction, 
  SavedColor, 
  UserProfile,
  GlobalConfig,
  TangibleGainType,
  IntangibleGainType,
  UnitMeasure,
  NotificationItem
} from './types';
import { cn, isValidUrl, formatUrl, cleanObject } from './lib/utils';
import MappingTab from './components/MappingTab';
import PDCAEditor from './components/PDCAEditor';
import DashboardView from './components/DashboardView';
import OperationalActionsTab from './components/OperationalActionsTab';
import ReportsTab from './components/ReportsTab';
import ProjectFilesSection from './components/ProjectFilesSection';
import NotificationBell from './components/NotificationBell';
import { notifyProjectChanges, notifySubtaskChanges } from './lib/notificationService';
import { calculateProjectProgress, calculateProjectStatus, calculateSubtaskStatus, getCardProgress, hasPendingSubtasksOrPDCA } from './lib/projectUtils';
import { calculateActionAlert } from './utils/calculations';

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
          active 
            ? "bg-indigo-600 dark:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-200/20" 
            : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50",
          collapsed ? "justify-center px-0" : ""
        )}
      >
        <div className={cn("flex-shrink-0", active ? "text-white" : "text-slate-400 dark:text-slate-500")}>
          {icon}
        </div>
        {!collapsed && <span className="whitespace-nowrap">{label}</span>}
      </button>
      
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 dark:bg-slate-700 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100] shadow-xl">
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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('gipflow_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('gipflow_theme', theme);
  }, [theme]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scope' | 'mapping' | 'pdca'>('scope');
  const [activeView, setActiveView] = useState<'kanban' | 'settings' | 'dashboard' | 'actions' | 'home'>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [operationalActions, setOperationalActions] = useState<OperationalAction[]>([]);
  const [targetSubtaskId, setTargetSubtaskId] = useState<string | null>(null);
  const [targetActionId, setTargetActionId] = useState<string | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({ 
    sectors: [], 
    tools: [],
    tangibleGainTypes: [],
    intangibleGainTypes: [],
    units: ['R$ (Reais)', 'Horas', '% (Percentual)', 'Unidades']
  });
  const [bpmnSavedColors, setBpmnSavedColors] = useState<SavedColor[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [hasChanges, setHasChanges] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigationAction, setPendingNavigationAction] = useState<(() => void) | null>(null);

  const hasChangesRef = useRef(hasChanges);
  const selectedProjectIdRef = useRef(selectedProjectId);

  useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  const handleNavigation = (action: () => void) => {
    if (hasChanges) {
      setPendingNavigationAction(() => action);
      setShowUnsavedModal(true);
    } else {
      action();
    }
  };

  const currentUserProfile = users.find(u => u.id === user?.uid);

  // Prevent accidental close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "Salve as últimas alterações para que não sejam perdidas";
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      // Sempre que o usuário logar ou o sistema for recarregado com um usuário ativo, 
      // garantimos que a tela inicial seja a 'home' com a logo.
      if (firebaseUser) {
        // Reset view when logging in but respect mode if already selected
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
      setProjects(prevProjects => {
        return projectsData.map(dbProj => {
          if (dbProj.id === selectedProjectIdRef.current && hasChangesRef.current) {
            const localProj = prevProjects.find(p => p.id === dbProj.id);
            if (localProj) {
              return localProj;
            }
          }
          return dbProj;
        });
      });
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

    // Listen for Notifications
    const notificationsUnsubscribe = onSnapshot(collection(db, 'notifications'), (snapshot) => {
      const notifsData = snapshot.docs.map(doc => doc.data() as NotificationItem);
      const currentUserId = user?.uid || auth.currentUser?.uid;
      const currentUserEmail = user?.email || auth.currentUser?.email;
      const loggedInUserObj = users.find(u => u.email?.toLowerCase() === currentUserEmail?.toLowerCase());
      
      const myNotifs = notifsData.filter(n => 
        n.usuario_id === currentUserId || 
        n.usuario_id === loggedInUserObj?.id ||
        (currentUserEmail && n.usuario_id === currentUserEmail)
      );
      setNotifications(myNotifs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));

    return () => {
      usersUnsubscribe();
      projectsUnsubscribe();
      configUnsubscribe();
      actionsUnsubscribe();
      colorsUnsubscribe();
      notificationsUnsubscribe();
    };
  }, [user]);

  // Sync User Profile to Firestore disabled to prevent automatic user creation on login
  useEffect(() => {
    // Access validation and control is handled strictly during the login popup flow.
    // This blocks automatic creation of new user profiles on login.
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.message === 'Login cancelado pelo usuário' || error.message === 'Popup blocked') {
        return; // Ignora graciosamente cancelamentos ou pop-up bloqueado se já alertado
      }
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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const handleConfirmNavigation = () => {
    setHasChanges(false);
    setShowUnsavedModal(false);
    if (pendingNavigationAction) {
      pendingNavigationAction();
      setPendingNavigationAction(null);
    }
  };

  const handleSaveAndExitNavigation = async () => {
    if (selectedProjectId) {
      const proj = projects.find(p => p.id === selectedProjectId);
      if (proj) {
        await persistProject(proj, true);
      }
    }
    setHasChanges(false);
    setShowUnsavedModal(false);
    if (pendingNavigationAction) {
      pendingNavigationAction();
      setPendingNavigationAction(null);
    }
  };

  // Unified save function
  const persistProject = async (projectToSync: Project, isManual: boolean = false) => {
    if (isManual) setIsSaving(true);
    setSaveStatus('saving');

    try {
      // Ensure data integrity
      const finalProject: Project = {
        ...projectToSync,
        status: calculateProjectStatus(projectToSync),
        createdAt: isValidDate(projectToSync.createdAt) 
          ? projectToSync.createdAt 
          : new Date().toISOString(),
        progress: getCardProgress(projectToSync),
        scope: {
          ...projectToSync.scope,
          title: projectToSync.name,
          startDate: isValidDate(projectToSync.scope?.startDate) 
            ? projectToSync.scope.startDate 
            : new Date().toISOString().split('T')[0],
          forecastCompletion: isValidDate(projectToSync.scope?.forecastCompletion) 
            ? projectToSync.scope.forecastCompletion 
            : new Date().toISOString().split('T')[0]
        },
        subtasks: (projectToSync.subtasks || []).map(s => ({
          ...s,
          status: calculateSubtaskStatus(s)
        }))
      };

      // Update local state immediately
      const oldProject = projects.find(p => p.id === finalProject.id) || null;
      setProjects(prev => prev.map(p => p.id === finalProject.id ? finalProject : p));
      
      const projectRef = doc(db, 'projects', finalProject.id);
      await setDoc(projectRef, cleanObject(finalProject));

      // Trigger notifications for card and subtasks
      notifyProjectChanges(oldProject, finalProject, auth.currentUser?.uid);
      const oldSubtasks = oldProject?.subtasks || [];
      const newSubtasks = finalProject.subtasks || [];
      for (const newSub of newSubtasks) {
        const oldSub = oldSubtasks.find(s => s.id === newSub.id) || null;
        notifySubtaskChanges(finalProject.id, finalProject.name, oldSub, newSub, auth.currentUser?.uid);
      }
      
      setSaveStatus('success');
      if (isManual) {
        console.log("✅ Projeto salvo manualmente com sucesso!");
        setHasChanges(false);
      }
    } catch (error: any) {
      console.error("❌ Falha ao salvar projeto:", error);
      setSaveStatus('error');
      handleFirestoreError(error, OperationType.WRITE, `projects/${projectToSync.id}`);
    } finally {
      if (isManual) {
        setTimeout(() => {
          setIsSaving(false);
          setSaveStatus('idle');
        }, 1500);
      } else {
        // Auto-save feedback lasts less
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }
  };

  const syncProjectToFirestore = (projectToSync: Project) => {
    // UPDATED: No longer auto-saves to Firestore to prevent high request count
    setProjects(prev => prev.map(p => p.id === projectToSync.id ? projectToSync : p));
    setHasChanges(true);
  };

  const handleManualSave = (projectToSave: Project) => {
    persistProject(projectToSave, true);
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

  const handleProjectClick = (id: string) => {
    setSelectedProjectId(id);
    setActiveTab('scope');
    setTargetSubtaskId(null);
    setTargetProjectId(null);
  };

  const handleCreateProject = async (data: { name: string, description: string, assignedTo: string, priority: ProjectPriority }) => {
    if (!user) return;
    const newId = uuidv4();
    const assignedUser = users.find(u => u.id === data.assignedTo);
    
    const newProject: Project = {
      id: newId,
      name: data.name,
      description: data.description,
      createdAt: new Date().toISOString(),
      progress: 0,
      status: data.assignedTo === 'backlog' ? 'Backlog' : 'Planejamento',
      priority: data.priority,
      assignedTo: data.assignedTo,
      scope: {
        title: data.name,
        responsible: data.assignedTo === 'backlog' ? 'Não atribuído' : (assignedUser?.name || 'Admin'),
        problemDescription: '',
        measurableObjective: '',
        involvedSectors: [],
        toolsUsed: [],
        startDate: new Date().toISOString().split('T')[0],
        forecastCompletion: new Date().toISOString().split('T')[0],
        presentationLink: '',
        ods: '',
        odsSelecionadas: [],
        esgSelecionado: [],
        odsDescricao: '',
        esgDescricao: '',
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
      console.log("⏳ Criando novo projeto no Firestore:", newId);
      await setDoc(doc(db, 'projects', newId), cleanObject(newProject));
      notifyProjectChanges(null, newProject, auth.currentUser?.uid);
      
      // Atualização otimista do estado local para exibição imediata
      setProjects(prev => {
        const alreadyExists = prev.some(p => p.id === newId);
        if (alreadyExists) return prev;
        return [...prev, newProject];
      });

      setIsCreateModalOpen(false);
      setSelectedProjectId(newId);
      setActiveTab('scope');
      console.log("✅ Projeto criado e selecionado.");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${newId}`);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const handleSelectNotification = (item: NotificationItem) => {
    if (item.tipo === 'card') {
      setActiveView('kanban');
      setSelectedProjectId(null);
      if (item.referencia_id) {
        setTargetProjectId(item.referencia_id);
      }
    } else if (item.tipo === 'acao') {
      setTargetActionId(item.referencia_id);
      setActiveView('actions');
    } else if (item.tipo === 'tarefa') {
      setActiveView('kanban');
      setSelectedProjectId(item.referencia_id);
      if (item.subtask_id) {
        setTargetSubtaskId(item.subtask_id);
      } else {
        setTargetSubtaskId(null);
      }
      setActiveTab('scope');
    }
  };

  const handleBackToKanban = () => {
    handleNavigation(() => {
      setSelectedProjectId(null);
      setHasChanges(false);
    });
  };

  const confirmNavigation = () => {
    if (hasChanges) {
      return confirm("Salve as últimas alterações para que não sejam perdidas");
    }
    return true;
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50 dark:bg-[#080b14] relative overflow-hidden p-4 font-sans transition-colors duration-700">
        {/* Deep Depth Background Components */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-slate-100/20 via-transparent to-blue-50/20 dark:from-slate-900/10 dark:to-[#003489]/05" />
          
          {/* High-end decorative blur - Consistent across themes */}
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-blue-100/30 dark:bg-blue-900/10 rounded-full blur-[140px]" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-100/20 dark:bg-indigo-900/10 rounded-full blur-[120px]" />
          
          <div 
            className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]" 
            style={{ 
              backgroundImage: 'radial-gradient(#003489 0.8px, transparent 0.8px)', 
              backgroundSize: '32px 32px' 
            }} 
          />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "w-full max-w-[440px] relative z-10",
            "bg-white dark:bg-[#111625]",
            "p-10 md:p-14 rounded-[2rem]",
            "border-2 border-[#003489] dark:border-slate-800/80",
            "shadow-[0_20px_60px_-15px_rgba(0,52,137,0.08)] dark:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.5)]",
            "flex flex-col items-center text-center space-y-12"
          )}
        >
          {/* Refined Brand Header */}
          <div className="space-y-8 w-full">
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100/80">
                <img 
                  src="/assets/logo-gipflow.svg" 
                  alt="GIP Flow" 
                  className="h-10 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-4xl font-extrabold text-[#003489] dark:text-blue-500 tracking-tight leading-none mb-1">
                GIP Flow
              </h2>
              <div className="h-1 w-12 bg-blue-500/20 dark:bg-blue-500/30 mx-auto rounded-full" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium pt-1 max-w-[300px] mx-auto leading-relaxed">
                Gestão inteligente de processos e melhoria contínua
              </p>
            </div>
          </div>

          {/* Action Core */}
          <div className="w-full space-y-8">
            <button 
              onClick={handleLogin}
              className={cn(
                "w-full h-16 flex items-center justify-center gap-4 py-0 px-8 rounded-2xl font-bold transition-all",
                "bg-[#003489] hover:bg-[#002868] dark:bg-blue-600 dark:hover:bg-blue-500 text-white",
                "shadow-[0_12px_24px_-8px_rgba(0,52,137,0.3)] dark:shadow-[0_12px_24px_-8px_rgba(37,99,235,0.4)]",
                "hover:-translate-y-1 hover:shadow-[0_20px_32px_-12px_rgba(0,52,137,0.4)] active:translate-y-0"
              )}
            >
              <div className="bg-white p-1.5 rounded-lg shrink-0">
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 shadow-sm" />
              </div>
              <span className="text-lg tracking-tight">Entrar com Google</span>
            </button>

            <div className="flex items-center gap-4 py-2 px-2">
              <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800/60" />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.25em] whitespace-nowrap">Ambiente Criptografado</span>
              <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800/60" />
            </div>
          </div>

          {/* Enhanced Trust Footer */}
          <div className="flex flex-col items-center gap-5 pt-2">
            <div className="flex items-center gap-2.5 px-5 py-2 bg-slate-50 dark:bg-white/05 rounded-full border border-slate-100 dark:border-white/05 transition-all hover:border-blue-200">
              <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400" />
              <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-widest">Single Sign-On Ativo</span>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-[0.4em]">
                Enterprise Workflow Suite
              </p>
              <p className="text-[8px] text-slate-300 dark:text-slate-700 font-medium">BPMN Engine 2.4.8-Stable</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-theme-background text-theme-foreground font-sans transition-colors duration-300">
        {/* Theme Toggle Floating and Mobile Menu */}
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-3">
          <NotificationBell
            notifications={notifications}
            onSelectNotification={handleSelectNotification}
          />

          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-3 bg-theme-card border border-theme-border rounded-2xl shadow-xl text-slate-400 hover:text-indigo-600 transition-all active:scale-95 group"
            title={theme === 'light' ? "Ativar Modo Escuro" : "Ativar Modo Claro"}
          >
            {theme === 'light' ? (
              <Moon size={20} className="group-hover:rotate-12 transition-transform" />
            ) : (
              <Sun size={20} className="group-hover:rotate-90 transition-transform text-amber-400" />
            )}
          </button>
          
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-3 bg-theme-card border border-theme-border rounded-2xl shadow-xl text-slate-400 hover:text-indigo-600 transition-all active:scale-95"
            title="Menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Sidebar Overlay for Mobile */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className={cn(
          "fixed left-0 top-0 h-full bg-theme-card border-r border-theme-border flex flex-col transition-all duration-300 z-50",
          isSidebarCollapsed ? "w-20" : "w-64",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          <div className="p-4 border-b border-theme-border flex flex-col items-center gap-4 shrink-0">
            <div className="flex items-center justify-between w-full min-w-0">
              <div className={cn("flex items-center overflow-hidden transition-all duration-300", isSidebarCollapsed ? "w-0 opacity-0" : "w-auto opacity-100 min-w-0 flex-1")}>
                <div className="w-auto h-10 bg-white rounded-xl flex items-center justify-center shadow-md border border-slate-100 p-1 flex-shrink-0 dark:bg-slate-100">
                  <img 
                    src="/assets/logo-gipflow.svg" 
                    alt="Logo" 
                    style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
                    referrerPolicy="no-referrer"
                  />
                </div>
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
              <div className="w-auto h-10 bg-white rounded-xl flex items-center justify-center shadow-md border border-slate-100 p-1 shrink-0 dark:bg-slate-100">
                <img 
                  src="/assets/logo-gipflow.svg" 
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
              onClick={() => handleNavigation(() => {
                setActiveView('dashboard');
                setSelectedProjectId(null);
                setHasChanges(false);
                setIsMobileMenuOpen(false);
              })}
              icon={<LayoutDashboard size={20} />}
              label="Dashboard"
              collapsed={isSidebarCollapsed}
            />
            <SidebarItem 
              active={activeView === 'kanban'}
              onClick={() => handleNavigation(() => {
                setActiveView('kanban');
                setSelectedProjectId(null);
                setHasChanges(false);
                setIsMobileMenuOpen(false);
              })}
              icon={<GitBranch size={20} />}
              label="Projetos"
              collapsed={isSidebarCollapsed}
            />
            <SidebarItem 
              active={activeView === 'actions'}
              onClick={() => handleNavigation(() => {
                setActiveView('actions');
                setSelectedProjectId(null);
                setHasChanges(false);
                setIsMobileMenuOpen(false);
              })}
              icon={<History size={20} />}
              label="Histórico de Ações"
              collapsed={isSidebarCollapsed}
            />
          </nav>

          {/* Configurações isolado na parte inferior */}
          <div className="p-4 border-t border-theme-border shrink-0">
            <SidebarItem 
              active={activeView === 'settings'}
              onClick={() => handleNavigation(() => {
                setActiveView('settings');
                setHasChanges(false);
                setIsMobileMenuOpen(false);
              })}
              icon={<Settings size={20} />}
              label="Configurações"
              collapsed={isSidebarCollapsed}
            />
          </div>

          <div className="p-4 border-t border-theme-border">
            <div className={cn("flex items-center gap-3 px-4 py-3 transition-all duration-300 min-w-0 w-full", isSidebarCollapsed ? "justify-center" : "")}>
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 border border-theme-border">
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
                  className="text-slate-400 hover:text-red-500 cursor-pointer shrink-0 transition-colors" 
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
                className="flex-1 flex flex-col items-center justify-center p-4 w-full"
              >
                 <div className="flex flex-col items-center gap-6 md:gap-8 text-center animate-in fade-in zoom-in duration-700 w-full max-w-sm md:max-w-none">
                    <div className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl shadow-indigo-100/40 border border-slate-100 w-full max-w-[300px] md:max-w-none">
                       <img 
                         src="/assets/logo-gipflow.svg" 
                         alt="Logo" 
                         className="h-20 md:h-32 w-auto mx-auto object-contain"
                         referrerPolicy="no-referrer"
                       />
                    </div>
                    <div className="space-y-4">
                      <h2 className="text-3xl md:text-5xl font-black text-[#003489] tracking-tighter" translate="no">GIP Flow</h2>
                      <div className="h-1.5 w-16 md:w-24 bg-indigo-600 mx-auto rounded-full" />
                      <p className="text-slate-400 text-sm md:text-lg font-medium tracking-wide">
                        Gestão Inteligente de Processos
                      </p>
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
                targetActionId={targetActionId || undefined}
              />
            ) : !selectedProjectId ? (
              <KanbanView 
                key="kanban"
                projects={projects} 
                users={users} 
                onProjectClick={handleProjectClick} 
                onCreateProject={() => setIsCreateModalOpen(true)}
                onDeleteProject={handleDeleteProject}
                targetProjectId={targetProjectId}
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
                saveStatus={saveStatus}
                initialSubtaskId={targetSubtaskId}
                onClearInitialSubtask={() => setTargetSubtaskId(null)}
                actions={operationalActions}
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

        {showUnsavedModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-8 space-y-6">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <AlertCircle size={32} />
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Alterações não salvas</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">
                    Salve as últimas alterações para que não sejam perdidas
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={handleSaveAndExitNavigation}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <Save size={18} />
                    Salvar e Sair
                  </button>
                  
                  <button 
                    onClick={handleConfirmNavigation}
                    className="w-full bg-slate-50 text-slate-600 py-3 rounded-2xl font-bold hover:bg-slate-100 transition-all border border-slate-200"
                  >
                    Sair sem Salvar
                  </button>

                  <button 
                    onClick={() => {
                      setShowUnsavedModal(false);
                      setPendingNavigationAction(null);
                    }}
                    className="w-full text-slate-400 py-2 rounded-2xl font-bold hover:text-slate-600 transition-all text-sm"
                  >
                    Permanecer na Tela
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

// --- KANBAN VIEW ---

function KanbanView({ projects, users, onProjectClick, onCreateProject, onDeleteProject, targetProjectId }: { 
  projects: Project[], 
  users: User[], 
  onProjectClick: (id: string) => void,
  onCreateProject: () => void,
  onDeleteProject: (id: string) => void,
  targetProjectId?: string | null,
  key?: string
}) {
  const [groupBy, setGroupBy] = useState<'status' | 'collaborator'>(() => {
    const savedTab = localStorage.getItem('kanbanActiveTab');
    if (savedTab === 'status' || savedTab === 'collaborator') {
      return savedTab;
    }
    return 'status';
  });
  const [visibleStatuses, setVisibleStatuses] = useState<ProjectStatus[]>(() => {
    try {
      const saved = sessionStorage.getItem('kanban_filter_statuses');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [visibleCollaborators, setVisibleCollaborators] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('kanban_filter_collaborators');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [visibleParticipants, setVisibleParticipants] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('kanban_filter_participants');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchTerm, setSearchTerm] = useState<string>(() => {
    try {
      return sessionStorage.getItem('kanban_filter_search') || '';
    } catch {
      return '';
    }
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Sync filters with sessionStorage
  useEffect(() => {
    sessionStorage.setItem('kanban_filter_statuses', JSON.stringify(visibleStatuses));
  }, [visibleStatuses]);

  useEffect(() => {
    sessionStorage.setItem('kanban_filter_collaborators', JSON.stringify(visibleCollaborators));
  }, [visibleCollaborators]);

  useEffect(() => {
    sessionStorage.setItem('kanban_filter_participants', JSON.stringify(visibleParticipants));
  }, [visibleParticipants]);

  useEffect(() => {
    sessionStorage.setItem('kanban_filter_search', searchTerm);
  }, [searchTerm]);

  // Scroll to targeted project card if arriving from a notification, or restore scroll position
  useEffect(() => {
    if (targetProjectId) {
      setSearchTerm('');
      setVisibleStatuses([]);
      setVisibleCollaborators([]);
      setVisibleParticipants([]);
      sessionStorage.removeItem('kanban_filter_statuses');
      sessionStorage.removeItem('kanban_filter_collaborators');
      sessionStorage.removeItem('kanban_filter_participants');
      sessionStorage.removeItem('kanban_filter_search');
      const timer = setTimeout(() => {
        const el = document.getElementById(`project-card-${targetProjectId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      const savedScroll = sessionStorage.getItem('kanban_scroll_y');
      if (savedScroll) {
        const timer = setTimeout(() => {
          window.scrollTo({ top: Number(savedScroll), behavior: 'instant' as ScrollBehavior });
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [targetProjectId]);

  const handleCardClick = (id: string) => {
    sessionStorage.setItem('kanban_scroll_y', window.scrollY.toString());
    onProjectClick(id);
  };

  const handleClearFilters = () => {
    setVisibleStatuses([]);
    setVisibleCollaborators([]);
    setVisibleParticipants([]);
    setSearchTerm('');
    sessionStorage.removeItem('kanban_filter_statuses');
    sessionStorage.removeItem('kanban_filter_collaborators');
    sessionStorage.removeItem('kanban_filter_participants');
    sessionStorage.removeItem('kanban_filter_search');
  };

  // Sync tab changes to localStorage for persistence
  const handleTabChange = (tab: 'status' | 'collaborator') => {
    setGroupBy(tab);
    localStorage.setItem('kanbanActiveTab', tab);
  };

  // Recover tab from localStorage upon load
  useEffect(() => {
    const savedTab = localStorage.getItem('kanbanActiveTab');
    if (savedTab === 'status' || savedTab === 'collaborator') {
      setGroupBy(savedTab);
    }
  }, []);

  const statuses: ProjectStatus[] = ['Backlog', 'Planejamento', 'Em andamento', 'Em melhoria', 'Concluído'];

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

  const toggleParticipant = (userId: string) => {
    setVisibleParticipants(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const filteredProjects = projects.map(p => ({ ...p, progress: getCardProgress(p) })).filter(p => {
    const projectParticipants = Array.from(new Set(p.subtasks?.map(s => s.responsibleId).filter(Boolean) || [])) as string[];
    
    const matchesStatus = visibleStatuses.length === 0 || visibleStatuses.includes(p.status);
    const matchesResponsible = visibleCollaborators.length === 0 || visibleCollaborators.includes(p.assignedTo);
    const matchesParticipant = visibleParticipants.length === 0 || visibleParticipants.some(id => projectParticipants.includes(id));
    
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.scope.responsible.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesResponsible && matchesParticipant && matchesSearch;
  });

  const activeFiltersCount = visibleStatuses.length + visibleCollaborators.length + visibleParticipants.length;

  const columns = groupBy === 'status' 
    ? (visibleStatuses.length === 0 ? statuses : statuses.filter(s => visibleStatuses.includes(s)))
    : (visibleCollaborators.length === 0 ? users : users.filter(u => visibleCollaborators.includes(u.id)));

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
              onClick={() => handleTabChange('status')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                groupBy === 'status' ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <Target size={16} />
              Status
            </button>
            <button 
              onClick={() => handleTabChange('collaborator')}
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
                            visibleCollaborators.includes(u.id) ? "bg-white text-indigo-600" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                          )}>
                            {u.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className={cn(
                            "text-xs font-bold truncate",
                            visibleCollaborators.includes(u.id) ? "text-white" : "text-slate-500 dark:text-slate-400"
                          )}>{u.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Filtrar Participantes</h4>
                      <div className="flex gap-2">
                        <button onClick={() => setVisibleParticipants(users.map(u => u.id))} className="text-[9px] font-bold text-indigo-600 hover:underline">Todos</button>
                        <button onClick={() => setVisibleParticipants([])} className="text-[9px] font-bold text-slate-400 hover:underline">Nenhum</button>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {users.map(u => (
                        <button 
                          key={u.id}
                          onClick={() => toggleParticipant(u.id)}
                          className={cn(
                            "w-full flex items-center gap-3 p-2 rounded-xl border transition-all text-left",
                            visibleParticipants.includes(u.id)
                              ? "bg-indigo-50 border-indigo-200"
                              : "bg-white border-slate-100 hover:border-slate-200"
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold uppercase",
                            visibleParticipants.includes(u.id) ? "bg-white text-indigo-600" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                          )}>
                            {u.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className={cn(
                            "text-xs font-bold truncate",
                            visibleParticipants.includes(u.id) ? "text-white" : "text-slate-500 dark:text-slate-400"
                          )}>{u.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                    <button 
                      onClick={handleClearFilters}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Limpar Filtros
                    </button>
                    <button 
                      onClick={() => setIsFilterOpen(false)}
                      className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
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

      <div className="flex flex-col lg:flex-row gap-6 overflow-x-auto pb-8 custom-scrollbar">
        {columns.map(col => {
          const colId = typeof col === 'string' ? col : col.id;
          const colTitle = typeof col === 'string' ? col : col.name;
          const colProjects = filteredProjects.filter(p => 
            groupBy === 'status' ? p.status === colId : (p.assignedTo === colId && p.status !== 'Backlog')
          );

          return (
            <div key={colId} className="flex flex-col gap-4 min-w-[320px] flex-1">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  {groupBy === 'status' ? (
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      colId === 'Backlog' ? "bg-slate-400" :
                      colId === 'Planejamento' ? "bg-amber-400" :
                      colId === 'Em andamento' ? "bg-blue-400" :
                      colId === 'Em melhoria' ? "bg-indigo-400" : "bg-emerald-400"
                    )} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase">
                      {(col as User).name.split(' ').map(n => n[0]).join('')}
                    </div>
                  )}
                  <h3 className="font-bold text-slate-700 dark:text-slate-200">{colTitle}</h3>
                  <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-medium">
                    {colProjects.length}
                  </span>
                </div>
              </div>

              <div className="bg-slate-100/50 dark:bg-slate-900/30 p-3 rounded-2xl flex-1 space-y-4 border border-slate-200/50 dark:border-slate-800/50">
                {colProjects.map(project => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                    users={users}
                    isHighlighted={targetProjectId === project.id}
                    onClick={() => handleCardClick(project.id)} 
                    onDelete={() => onDeleteProject(project.id)}
                  />
                ))}
                
                {colProjects.length === 0 && (
                  <div className="py-10 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <Target size={24} className="mb-2 opacity-20" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Vazio</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function ProjectCard({ project, users, onClick, onDelete, isHighlighted }: { project: Project, users: User[], onClick: () => void, onDelete: () => void, isHighlighted?: boolean, key?: string }) {
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
    'Backlog': 'bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-500/20',
    'Planejamento': 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
    'Em andamento': 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
    'Em melhoria': 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
    'Concluído': 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  };

  const priorityColors = {
    'Baixa': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    'Média': 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    'Alta': 'bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
  };

  return (
    <motion.div 
      id={`project-card-${project.id}`}
      whileHover={{ y: -4, shadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
      className={cn(
        "bg-white p-5 rounded-xl border border-slate-200 cursor-pointer transition-all relative group",
        isHighlighted && "ring-2 ring-indigo-500 bg-indigo-50/20 font-bold shadow-xl"
      )}
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

      <h4 className="font-bold text-slate-800 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
        {project.name}
      </h4>

      {project.description && (
        <p className="text-[11px] text-slate-500 mb-4 line-clamp-2 leading-relaxed">
          {project.description}
        </p>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Responsável:</span>
            <span className="font-bold text-slate-700 truncate">{assignedUser?.name || 'Não atribuído'}</span>
          </div>
          
          <div className="flex items-center gap-2 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Participantes:</span>
            <span className="font-bold text-slate-700 truncate">
              {(() => {
                const participantIds = Array.from(new Set(project.subtasks?.map(s => s.responsibleId).filter(Boolean) || []));
                const participantNames = participantIds.map(id => users.find(u => u.id === id)?.name).filter(Boolean);
                return participantNames.length > 0 ? participantNames.join(', ') : 'Sem participantes';
              })()}
            </span>
          </div>
        </div>

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

        {hasPendingSubtasksOrPDCA(project) && (project.status === 'Concluído' || project.progress === 99) && (
          <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-900/30 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span className="truncate">Existem subtarefas ou PDCAs pendentes</span>
          </div>
        )}
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
  onDeleteGlobalColor,
  saveStatus,
  initialSubtaskId,
  onClearInitialSubtask,
  actions = []
}: { 
  project: Project, 
  activeTab: string, 
  setActiveTab: (tab: any) => void,
  onBack: () => void,
  setProjects: (p: Project) => void,
  onSave: (p: Project) => void,
  isSaving: boolean,
  users: User[],
  globalConfig: GlobalConfig,
  savedColors: SavedColor[],
  onSaveGlobalColor: (color: SavedColor) => void,
  onDeleteGlobalColor: (id: string) => void,
  saveStatus: 'idle' | 'saving' | 'success' | 'error',
  initialSubtaskId?: string | null,
  onClearInitialSubtask?: () => void,
  key?: string,
  actions?: OperationalAction[]
}) {
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(
    activeTab !== 'scope' ? initialSubtaskId || null : null
  );

  useEffect(() => {
    if (initialSubtaskId && activeTab !== 'scope') {
      setSelectedSubtaskId(initialSubtaskId);
      if (onClearInitialSubtask) onClearInitialSubtask();
    }
  }, [initialSubtaskId, activeTab, onClearInitialSubtask]);

  const selectedSubtask = project.subtasks?.find(s => s.id === selectedSubtaskId);

  const handleUpdateSubtask = (updatedSubtask: Subtask) => {
    // Inject automatic status
    const subtaskWithCalculatedStatus = {
      ...updatedSubtask,
      status: calculateSubtaskStatus(updatedSubtask)
    };

    const updatedCycles = subtaskWithCalculatedStatus.pdcaCycles || [];

    const updatedSubtasks = (project.subtasks || []).map(s => {
      if (s.id === subtaskWithCalculatedStatus.id) {
        return subtaskWithCalculatedStatus;
      }

      let sCycles = [...(s.pdcaCycles || [])];
      let changed = false;

      // Synchronize shared/linked PDCA cycles
      updatedCycles.forEach(uCycle => {
        const isExplicitlyLinked = uCycle.linkedSubtaskIds?.includes(s.id);
        const existingIndex = sCycles.findIndex(c => c.id === uCycle.id);

        if (existingIndex !== -1) {
          // If explicitly unlinked via linkedSubtaskIds, remove it
          if (uCycle.linkedSubtaskIds && !isExplicitlyLinked) {
            sCycles.splice(existingIndex, 1);
            changed = true;
          } else {
            // Otherwise sync updated cycle data
            sCycles[existingIndex] = uCycle;
            changed = true;
          }
        } else if (isExplicitlyLinked) {
          // Add shared cycle to this subtask
          sCycles = [uCycle, ...sCycles];
          changed = true;
        }
      });

      if (changed) {
        const updatedS = { ...s, pdcaCycles: sCycles };
        return {
          ...updatedS,
          status: calculateSubtaskStatus(updatedS)
        };
      }

      return s;
    });

    setProjects({ ...project, subtasks: updatedSubtasks });
  };

  // If a subtask is selected, we show the "Execution" view (Mapping + PDCA)
  if (selectedSubtaskId && selectedSubtask) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col h-full bg-theme-background"
      >
        {/* Subtask Header */}
        <div className="bg-theme-card border-b border-theme-border px-4 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-10 transition-colors gap-4">
          <div className="flex items-center gap-2 lg:gap-4 flex-1">
            <button 
              onClick={() => {
                setSelectedSubtaskId(null);
                setActiveTab('scope');
              }}
              className="p-2 hover:bg-theme-background rounded-lg transition-colors text-slate-400 flex items-center gap-2 font-bold text-[10px] md:text-sm shrink-0"
            >
              <ChevronRight size={20} className="rotate-180" />
              <span className="hidden sm:inline">Voltar ao Escopo</span>
            </button>
            <div className="h-6 w-px bg-theme-border hidden sm:block" />
            <div className="min-w-0">
              <h3 className="text-sm md:text-lg font-bold text-theme-foreground truncate">
                {selectedSubtask.title}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium truncate">Projeto: {project.scope.title}</p>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-2 lg:gap-4">
            <div className="flex bg-theme-background p-1 rounded-xl border border-theme-border overflow-x-auto">
              <TabButton 
                active={activeTab === 'mapping'} 
                onClick={() => setActiveTab('mapping')} 
                icon={<GitBranch size={16} />} 
                label="Map" 
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
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg",
                saveStatus === 'success' ? "bg-emerald-600 text-white" :
                saveStatus === 'error' ? "bg-rose-500 text-white" :
                "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-100",
                isSaving && "opacity-50"
              )}
            >
              {saveStatus === 'saving' ? <RefreshCw size={18} className="animate-spin" /> : 
               saveStatus === 'success' ? <CheckCircle2 size={18} /> :
               saveStatus === 'error' ? <AlertCircle size={18} /> :
               <Save size={18} />}
              {saveStatus === 'saving' ? 'Salvando...' : 
               saveStatus === 'success' ? 'Salvo!' : 
               saveStatus === 'error' ? 'Erro!' : 
               'Salvar'}
            </button>
          </div>
        </div>

        <div className="flex-1">
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
              globalConfig={globalConfig}
              userProfile={users.find(u => u.id === auth.currentUser?.uid)?.profile || auth.currentUser?.profile}
              onBack={() => {
                setSelectedSubtaskId(null);
                setActiveTab('scope');
              }}
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
      <div className="sticky top-0 z-[50] bg-theme-background/95 backdrop-blur-sm -mx-4 lg:-mx-8 px-4 lg:px-8 py-4 mb-8 border-b border-theme-border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-4 flex-1">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-theme-card rounded-lg transition-colors text-slate-400 shrink-0"
          >
            <ChevronRight size={24} className="rotate-180" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <textarea 
                value={project.name}
                onChange={(e) => {
                  setProjects({ 
                    ...project, 
                    name: e.target.value,
                    scope: { ...project.scope, title: e.target.value }
                  });
                }}
                rows={1}
                onInput={(e) => {
                  e.currentTarget.style.height = 'auto';
                  e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                }}
                className="text-2xl font-bold text-theme-foreground bg-transparent border-b border-transparent hover:border-theme-border focus:border-indigo-500 outline-none transition-all resize-none overflow-hidden w-full h-auto whitespace-normal break-words py-1"
                placeholder="Título do Projeto"
              />
              {isSaving && (
                <span className={cn(
                  "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest animate-pulse shrink-0",
                  saveStatus === 'error' ? "text-rose-500" : "text-indigo-400"
                )}>
                  <RefreshCw size={10} className={cn(saveStatus === 'saving' && "animate-spin")} />
                  {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'success' ? 'Salvo!' : saveStatus === 'error' ? 'Erro!' : 'Salvando...'}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <Users size={14} />
                {project.scope.responsible}
              </span>
              <span className="w-1 h-1 bg-theme-border rounded-full" />
              <span className="flex items-center gap-1">
                <Clock size={14} />
                Iniciado em {isValidDate(project.createdAt) ? format(new Date(project.createdAt), 'dd/MM/yyyy') : 'Data Inválida'}
              </span>
              <span className="w-1 h-1 bg-theme-border rounded-full" />
              <select 
                value={project.priority || 'Média'}
                onChange={(e) => setProjects({ ...project, priority: e.target.value as ProjectPriority })}
                className={cn(
                  "text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border outline-none transition-all",
                  project.priority === 'Alta' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                  project.priority === 'Média' ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                  "bg-theme-background text-slate-400 border-theme-border"
                )}
              >
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          <div className="hidden md:flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Progresso</span>
              <span className="text-lg font-black text-indigo-400">{getCardProgress(project)}%</span>
            </div>
            <div className="w-32 h-2 bg-theme-border rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${getCardProgress(project)}%` }}
                className="h-full bg-indigo-500 rounded-full"
              />
            </div>
            {hasPendingSubtasksOrPDCA(project) && (project.status === 'Concluído' || getCardProgress(project) === 99) && (
              <span className="text-[10px] text-amber-500 font-bold tracking-tight text-right max-w-[150px]">
                ⚠️ Existem subtarefas ou PDCAs pendentes
              </span>
            )}
          </div>
          <button 
            onClick={() => onSave(project)}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      <div className="bg-theme-card rounded-2xl border border-theme-border shadow-sm min-h-[600px] overflow-hidden">
        {activeTab === 'scope' && (
          <ScopeTab 
            project={project} 
            setProjects={setProjects} 
            users={users} 
            globalConfig={globalConfig} 
            actions={actions}
            targetSubtaskId={initialSubtaskId}
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
          ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-md border border-indigo-500/20" 
          : "text-slate-500 dark:text-slate-400 hover:bg-theme-card/50 hover:text-slate-400"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// --- SCOPE TAB ---

const ODS_LIST = [
  { id: 1, label: "ODS 1", name: "Erradicação da Pobreza", color: "#e5243b" },
  { id: 2, label: "ODS 2", name: "Fome Zero e Agricultura Sustentável", color: "#dda63a" },
  { id: 3, label: "ODS 3", name: "Saúde e Bem-Estar", color: "#4c9f38" },
  { id: 4, label: "ODS 4", name: "Educação de Qualidade", color: "#c5192d" },
  { id: 5, label: "ODS 5", name: "Igualdade de Gênero", color: "#ff3a21" },
  { id: 6, label: "ODS 6", name: "Água Potável e Saneamento", color: "#26bde2" },
  { id: 7, label: "ODS 7", name: "Energia Limpa e Acessível", color: "#fcc30b", textDark: true },
  { id: 8, label: "ODS 8", name: "Trabalho Decente e Crescimento Econômico", color: "#a21942" },
  { id: 9, label: "ODS 9", name: "Indústria, Inovação e Infraestrutura", color: "#fd6925" },
  { id: 10, label: "ODS 10", name: "Redução das Desigualdades", color: "#dd1367" },
  { id: 11, label: "ODS 11", name: "Cidades e Comunidades Sustentáveis", color: "#fd9d24" },
  { id: 12, label: "ODS 12", name: "Consumo e Produção Responsáveis", color: "#c78b1a" },
  { id: 13, label: "ODS 13", name: "Ação Contra a Mudança Global do Clima", color: "#3f7e44" },
  { id: 14, label: "ODS 14", name: "Vida na Água", color: "#0a97d9" },
  { id: 15, label: "ODS 15", name: "Vida Terrestre", color: "#56c02b" },
  { id: 16, label: "ODS 16", name: "Paz, Justiça e Instituições Eficazes", color: "#00689d" },
  { id: 17, label: "ODS 17", name: "Parcerias e Meios de Implementação", color: "#1f476a" },
];

interface SubtaskActionsTooltipProps {
  rect: { top: number; left: number; width: number; height: number };
  actions: OperationalAction[];
  subtaskId: string;
}

function SubtaskActionsTooltip({ rect, actions, subtaskId }: SubtaskActionsTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; opacity: number }>({ top: 0, left: 0, opacity: 0 });

  const subtaskActions = (actions || []).filter(a => a.subtaskId === subtaskId);
  if (subtaskActions.length === 0) return null;

  // Sort actions: 1. Atrasadas, 2. Em andamento, 3. Concluídas
  const sorted = [...subtaskActions].sort((a, b) => {
    const isLateA = calculateActionAlert(a) === 'Atrasado';
    const isLateB = calculateActionAlert(b) === 'Atrasado';
    if (isLateA && !isLateB) return -1;
    if (!isLateA && isLateB) return 1;

    const isCompletedA = a.status === 'Concluído';
    const isCompletedB = b.status === 'Concluído';
    if (!isCompletedA && isCompletedB) return -1;
    if (isCompletedA && !isCompletedB) return 1;

    return 0;
  });

  const displayedActions = sorted.slice(0, 3);
  const extraCount = subtaskActions.length - 3;

  useLayoutEffect(() => {
    if (!tooltipRef.current) return;
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width || 320;
    const tooltipHeight = tooltipRect.height || 250;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;

    // 1. Vertical positioning
    // Default is BELOW
    let idealTop = rect.top + rect.height + 8;
    
    // Check if it fits below
    if (idealTop + tooltipHeight > viewportHeight - margin) {
      // Doesn't fit below, try ABOVE
      const topAbove = rect.top - tooltipHeight - 8;
      if (topAbove >= margin) {
        idealTop = topAbove;
      } else {
        // Doesn't fit above either, place where there is more space and clamp
        const spaceBelow = viewportHeight - (rect.top + rect.height);
        const spaceAbove = rect.top;
        if (spaceAbove > spaceBelow) {
          idealTop = Math.max(margin, rect.top - tooltipHeight - 8);
        } else {
          idealTop = Math.min(viewportHeight - tooltipHeight - margin, rect.top + rect.height + 8);
        }
      }
    }

    // 2. Horizontal positioning (Centered on subtask by default)
    let idealLeft = rect.left + (rect.width / 2) - (tooltipWidth / 2);
    
    // Clamp to viewport boundaries
    if (idealLeft + tooltipWidth > viewportWidth - margin) {
      idealLeft = viewportWidth - tooltipWidth - margin;
    }
    if (idealLeft < margin) {
      idealLeft = margin;
    }

    setPosition({
      top: idealTop,
      left: idealLeft,
      opacity: 1
    });
  }, [rect, subtaskId, subtaskActions.length]);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <motion.div
        ref={tooltipRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: position.opacity, scale: position.opacity > 0 ? 1 : 0.95 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="absolute bg-white border border-slate-200/85 shadow-2xl p-4 rounded-2xl w-80 text-left pointer-events-none text-slate-800"
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
              <Clock size={12} />
              Ações Recentes ({subtaskActions.length})
            </span>
          </div>
          
          <div className="space-y-3">
            {displayedActions.map((act) => {
              const alert = calculateActionAlert(act);
              let alertLabel = 'No prazo';
              let alertIcon = <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />;
              
              if (alert === 'Atrasado') {
                alertLabel = 'Atrasado';
                alertIcon = <AlertCircle size={12} className="text-rose-500 shrink-0" />;
              } else if (alert === 'Próximo do vencimento') {
                alertLabel = 'Próximo';
                alertIcon = <Clock size={12} className="text-amber-500 shrink-0" />;
              } else if (act.status === 'Concluído') {
                alertLabel = 'OK';
                alertIcon = <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />;
              }
              
              const truncatedFeedback = act.feedback 
                ? (act.feedback.length > 70 ? act.feedback.slice(0, 70) + '...' : act.feedback)
                : 'Sem retorno cadastrado';
                
              return (
                <div key={act.id} className="text-xs space-y-1">
                  <div className="font-extrabold text-slate-800 flex items-start gap-1">
                    <span className="text-indigo-500 mt-0.5">•</span>
                    <span>{act.action}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-400 pl-3">
                    <div>Prioridade: <span className={cn(
                      "font-extrabold",
                      act.priority === 'Alta' || act.priority === 'Urgente' ? "text-rose-500" :
                      act.priority === 'Média' ? "text-indigo-500" : "text-slate-500"
                    )}>{act.priority}</span></div>
                    <div>Status: <span className={cn(
                      "font-extrabold",
                      act.status === 'Concluído' ? "text-emerald-500" :
                      act.status === 'Em andamento' ? "text-amber-500" : "text-slate-500"
                    )}>{act.status}</span></div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 pl-3">
                    <span>Prazo:</span>
                    <span className="flex items-center gap-0.5 font-extrabold">
                      {alertIcon}
                      <span className={cn(
                        alert === 'Atrasado' ? "text-rose-500" :
                        alert === 'Próximo do vencimento' ? "text-amber-500" :
                        act.status === 'Concluído' ? "text-emerald-500" : "text-emerald-600"
                      )}>{alertLabel}</span>
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 pl-3 italic bg-slate-50 p-1.5 rounded-lg border border-slate-100 mt-1 leading-normal break-words">
                    Retorno: {truncatedFeedback}
                  </div>
                </div>
              );
            })}
          </div>
          
          {extraCount > 0 && (
            <div className="text-[9px] font-bold text-indigo-500 bg-indigo-50/60 px-2 py-0.5 rounded text-center">
              e mais {extraCount} {extraCount === 1 ? 'ação' : 'ações'}...
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ScopeTab({ 
  project, 
  setProjects, 
  users, 
  globalConfig,
  onSelectSubtask,
  actions = [],
  targetSubtaskId
}: { 
  project: Project, 
  setProjects: (p: Project) => void, 
  users: User[], 
  globalConfig: GlobalConfig,
  onSelectSubtask: (taskId: string) => void,
  actions?: OperationalAction[],
  targetSubtaskId?: string | null
}) {
  const currentUserProfile = users.find(u => u.id === auth.currentUser?.uid);
  const profile = currentUserProfile?.profile || 'Usuário Analista';

  useEffect(() => {
    if (targetSubtaskId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`subtask-row-${targetSubtaskId}`) || document.getElementById('subtasks-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [targetSubtaskId]);

  const [isSubtaskModalOpen, setIsSubtaskModalOpen] = useState(false);
  const [newSubtaskData, setNewSubtaskData] = useState({
    title: '',
    priority: 'Média' as ProjectPriority,
    status: 'Pendente' as any,
    responsibleId: ''
  });
  
  const [subtaskToDelete, setSubtaskToDelete] = useState<string | null>(null);
  const [editingSubtask, setEditingSubtask] = useState<string | null>(null);
  const [tempSubtaskData, setTempSubtaskData] = useState<{title: string, priority: ProjectPriority, responsibleId: string} | null>(null);

  const [odsSearch, setOdsSearch] = useState('');
  const [odsDropdownOpen, setOdsDropdownOpen] = useState(false);
  const odsDropdownRef = useRef<HTMLDivElement>(null);

  const [hoveredSubtaskActionsId, setHoveredSubtaskActionsId] = useState<string | null>(null);
  const [hoveredSubtaskRect, setHoveredSubtaskRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const hoverTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleMouseEnterSubtask = (e: React.MouseEvent<HTMLDivElement>, subtaskId: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredSubtaskActionsId(subtaskId);
      setHoveredSubtaskRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
    }, 200);
  };

  const handleMouseLeaveSubtask = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredSubtaskActionsId(null);
    setHoveredSubtaskRect(null);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (odsDropdownRef.current && !odsDropdownRef.current.contains(event.target as Node)) {
        setOdsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateScope = (field: string, value: any) => {
    const updatedProject = { ...project, scope: { ...project.scope, [field]: value } };
    if (field === 'title') {
      updatedProject.name = value;
    }
    setProjects(updatedProject);
  };

  const handleReassign = (userId: string) => {
    const oldProj = { ...project };
    if (userId === 'backlog') {
      const updated = {
        ...project,
        assignedTo: 'backlog',
        status: 'Backlog' as ProjectStatus,
        scope: { ...project.scope, responsible: 'Não atribuído' }
      };
      setProjects(updated);
      notifyProjectChanges(oldProj, updated, auth.currentUser?.uid);
      return;
    }
    const selectedUser = users.find(u => u.id === userId);
    if (selectedUser) {
      const updated = { 
        ...project, 
        assignedTo: userId,
        status: project.status === 'Backlog' ? 'Planejamento' as ProjectStatus : project.status,
        scope: { ...project.scope, responsible: selectedUser.name }
      };
      setProjects(updated);
      notifyProjectChanges(oldProj, updated, auth.currentUser?.uid);
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
      status: 'Pendente',
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

    if (newSubtask.responsibleId) {
      notifySubtaskChanges(project.id, project.name, null, newSubtask, auth.currentUser?.uid);
    }

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
    const oldSubtask = (project.subtasks || []).find(s => s.id === id) || null;
    const updatedSubtasks = (project.subtasks || []).map(s => 
      s.id === id ? { ...s, [field]: value } : s
    );
    const newSubtask = updatedSubtasks.find(s => s.id === id);
    if (newSubtask && field === 'responsibleId' && value) {
      notifySubtaskChanges(project.id, project.name, oldSubtask, newSubtask, auth.currentUser?.uid);
    }
    setProjects({ ...project, subtasks: updatedSubtasks });
  };

  const deleteSubtask = (id: string) => {
    const updatedSubtasks = (project.subtasks || []).filter(s => s.id !== id);
    setProjects({ ...project, subtasks: updatedSubtasks });
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 md:space-y-12">
      {/* 1. INFORMAÇÕES GERAIS */}
      <section className="bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm space-y-6 md:space-y-8">
        <h3 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl md:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileText size={20} />
          </div>
          Informações Gerais
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="space-y-6">
            <FormField 
              label="Título do Projeto" 
              value={project.scope.title} 
              onChange={(v) => updateScope('title', v)}
            />
            <FormField 
              label="Descrição do projeto" 
              value={project.description || ''} 
              type="textarea"
              placeholder="Descreva brevemente o objetivo deste projeto..."
              onChange={(v) => setProjects({ ...project, description: v.slice(0, 300) })}
            />
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Responsável</label>
              <select 
                value={project.assignedTo}
                onChange={(e) => handleReassign(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-medium text-sm"
              >
                <option value="backlog">Backlog</option>
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
              {project.scope.presentationLink && isValidUrl(project.scope.presentationLink) && (
                <a 
                  href={formatUrl(project.scope.presentationLink)} 
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
      <section className="bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm space-y-6 md:space-y-8">
        <h3 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl md:rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Target size={20} />
          </div>
          Contexto do Projeto
        </h3>
        <div className="space-y-6 md:space-y-8">
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
      <section className="bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm space-y-6 md:space-y-8">
        <h3 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl md:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Briefcase size={20} />
          </div>
          Estrutura do Projeto
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          <div className="space-y-8">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-3 block ml-1">Setores Envolvidos</label>
              <div className="flex flex-wrap gap-2 mb-4">
                {[...project.scope.involvedSectors].sort((a, b) => a.name.localeCompare(b.name)).map(s => (
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
                {[...globalConfig.sectors].sort((a, b) => a.localeCompare(b)).map((s, sIdx) => (
                  <option key={`${s}-${sIdx}`} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-3 block ml-1">Ferramentas Utilizadas</label>
              <div className="flex flex-wrap gap-2 mb-4">
                {[...project.scope.toolsUsed].sort((a, b) => a.name.localeCompare(b.name)).map(t => (
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
                {[...globalConfig.tools].sort((a, b) => a.localeCompare(b)).map((t, tIdx) => (
                  <option key={`${t}-${tIdx}`} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:gap-8">
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
      <section className="bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm space-y-6 md:space-y-8">
        <h3 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl md:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Globe size={20} />
          </div>
          ODS (Objetivos de Desenvolvimento Sustentável)
        </h3>
        
        <div className="space-y-4">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Associações ODS Estruturadas (Múltipla Escolha)</label>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {(project.scope?.odsSelecionadas || []).map(id => {
              const ods = ODS_LIST.find(o => o.id === id);
              if (!ods) return null;
              return (
                <span 
                  key={id} 
                  style={{ backgroundColor: ods.color }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm transition-all ${ods.textDark ? 'text-slate-900' : 'text-white'}`}
                >
                  <span>{ods.label}: {ods.name}</span>
                  <button 
                    type="button"
                    onClick={() => {
                      const updated = (project.scope?.odsSelecionadas || []).filter(item => item !== id);
                      updateScope('odsSelecionadas', updated);
                    }}
                    className="rounded-full hover:bg-black/15 p-0.5 shrink-0 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
            {(!project.scope?.odsSelecionadas || project.scope.odsSelecionadas.length === 0) && (
              <span className="text-sm font-medium text-slate-400 italic">Nenhuma ODS selecionada ainda. Utilize a busca abaixo para associar.</span>
            )}
          </div>

          <div className="relative font-medium" ref={odsDropdownRef}>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 tracking-wide">
              <Search size={18} className="text-slate-400 mr-2 shrink-0" />
              <input 
                type="text"
                placeholder="Buscar ODS oficiais (Ex: Saúde, Trabalho, Igualdade...)"
                value={odsSearch}
                onChange={(e) => {
                  setOdsSearch(e.target.value);
                  setOdsDropdownOpen(true);
                }}
                onFocus={() => setOdsDropdownOpen(true)}
                className="w-full bg-transparent border-none text-sm outline-none text-slate-700"
              />
              {odsSearch && (
                <button 
                  type="button"
                  onClick={() => setOdsSearch('')}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {odsDropdownOpen && (
              <div className="absolute z-50 left-0 right-0 mt-2 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
                {ODS_LIST.filter(ods => 
                  ods.label.toLowerCase().includes(odsSearch.toLowerCase()) || 
                  ods.name.toLowerCase().includes(odsSearch.toLowerCase())
                ).map(ods => {
                  const currentSelected = project.scope?.odsSelecionadas || [];
                  const isSelected = currentSelected.includes(ods.id);
                  return (
                    <button
                      key={ods.id}
                      type="button"
                      onClick={() => {
                        let updated: number[];
                        if (isSelected) {
                          updated = currentSelected.filter(id => id !== ods.id);
                        } else {
                          updated = [...currentSelected, ods.id];
                        }
                        updateScope('odsSelecionadas', updated);
                      }}
                      className="w-full px-4 py-3 flex items-center justify-between text-left text-sm hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span 
                          style={{ backgroundColor: ods.color }} 
                          className={`w-14 text-center shrink-0 text-[10px] font-black py-1 rounded-md shadow-sm ${ods.textDark ? 'text-slate-900' : 'text-white'}`}
                        >
                          {ods.label}
                        </span>
                        <span className="font-semibold text-slate-700">{ods.name}</span>
                      </div>
                      {isSelected && (
                        <Check size={16} className="text-indigo-600 font-bold shrink-0" />
                      )}
                    </button>
                  );
                })}
                {ODS_LIST.filter(ods => 
                  ods.label.toLowerCase().includes(odsSearch.toLowerCase()) || 
                  ods.name.toLowerCase().includes(odsSearch.toLowerCase())
                ).length === 0 && (
                  <div className="px-4 py-4 text-center text-sm text-slate-400">
                    Nenhuma ODS encontrada com "{odsSearch}".
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <FormField 
          label="ODS (Descrição Livre)" 
          value={project.scope.odsDescricao || project.scope.ods || ''} 
          type="textarea"
          placeholder="Descreva detalhadamente como o projeto se correlaciona e atinge as ODS selecionadas..."
          onChange={(v) => {
            updateScope('odsDescricao', v);
            updateScope('ods', v);
          }}
        />
      </section>

      {/* 5. ESG */}
      <section className="bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm space-y-6 md:space-y-8">
        <h3 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl md:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Leaf size={20} />
          </div>
          ESG (Environmental, Social and Governance)
        </h3>

        <div className="space-y-6">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Associações ESG Estruturadas (Selecione 1 ou mais)</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* E - Environmental */}
            <button
              type="button"
              onClick={() => {
                const currentSelected = project.scope?.esgSelecionado || [];
                const updated = currentSelected.includes('E')
                  ? currentSelected.filter(k => k !== 'E')
                  : [...currentSelected, 'E'];
                updateScope('esgSelecionado', updated);
              }}
              className={`p-4 rounded-2xl border text-left flex items-start gap-4 transition-all duration-200 ${
                (project.scope?.esgSelecionado || []).includes('E')
                  ? 'bg-emerald-50/75 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                  : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                (project.scope?.esgSelecionado || []).includes('E') ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600'
              }`}>
                <Leaf size={24} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-lg text-slate-800">E</span>
                  <span className="font-bold text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Environmental</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-medium select-none">Impacto e conservação ambiental.</p>
              </div>
            </button>

            {/* S - Social */}
            <button
              type="button"
              onClick={() => {
                const currentSelected = project.scope?.esgSelecionado || [];
                const updated = currentSelected.includes('S')
                  ? currentSelected.filter(k => k !== 'S')
                  : [...currentSelected, 'S'];
                updateScope('esgSelecionado', updated);
              }}
              className={`p-4 rounded-2xl border text-left flex items-start gap-4 transition-all duration-200 ${
                (project.scope?.esgSelecionado || []).includes('S')
                  ? 'bg-rose-50/75 border-rose-500 ring-2 ring-rose-500/20 shadow-sm'
                  : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                (project.scope?.esgSelecionado || []).includes('S') ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600'
              }`}>
                <Heart size={24} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-lg text-slate-800">S</span>
                  <span className="font-bold text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800">Social</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-medium select-none">Relações humanas, bem-estar e cultura.</p>
              </div>
            </button>

            {/* G - Governance */}
            <button
              type="button"
              onClick={() => {
                const currentSelected = project.scope?.esgSelecionado || [];
                const updated = currentSelected.includes('G')
                  ? currentSelected.filter(k => k !== 'G')
                  : [...currentSelected, 'G'];
                updateScope('esgSelecionado', updated);
              }}
              className={`p-4 rounded-2xl border text-left flex items-start gap-4 transition-all duration-200 ${
                (project.scope?.esgSelecionado || []).includes('G')
                  ? 'bg-indigo-50/75 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                  : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                (project.scope?.esgSelecionado || []).includes('G') ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-600'
              }`}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-lg text-slate-800">G</span>
                  <span className="font-bold text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">Governance</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-medium select-none">Conformidade, processos e governança.</p>
              </div>
            </button>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 mt-6 space-y-6">
          <h4 className="text-sm font-extrabold text-slate-700 tracking-wider uppercase ml-1">Análises ESG Detalhadas por Área</h4>
          <div className="grid grid-cols-1 gap-8">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0 sm:mt-6">
                <Leaf size={24} />
              </div>
              <div className="flex-1 w-full">
                <FormField 
                  label="E – Environmental" 
                  value={project.scope.esgEnvironmental || ''} 
                  type="textarea"
                  placeholder="Descreva os impactos ambientais do projeto..."
                  onChange={(v) => updateScope('esgEnvironmental', v)}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 mt-0 sm:mt-6">
                <Heart size={24} />
              </div>
              <div className="flex-1 w-full">
                <FormField 
                  label="S – Social" 
                  value={project.scope.esgSocial || ''} 
                  type="textarea"
                  placeholder="Ex: Qualidade de vida, bem-estar, impacto nos colaboradores..."
                  onChange={(v) => updateScope('esgSocial', v)}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0 sm:mt-6">
                <ShieldCheck size={24} />
              </div>
              <div className="flex-1 w-full">
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
        </div>
      </section>

      {/* 6. Arquivos do Projeto */}
      <ProjectFilesSection 
        project={project} 
        onUpdateProject={(updates) => {
          setProjects({ ...project, ...updates } as Project);
        }} 
      />

      {/* 7. SUBTAREFAS (LIST FORMAT) */}
      <section id="subtasks-section" className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
            <div className="w-auto h-10 rounded-2xl bg-white border border-slate-100 p-1 flex items-center justify-center shadow-md">
              <img 
                src="/assets/logo-gipflow.svg" 
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
                const isEditing = editingSubtask === subtask.id;
                
                // Status is now calculated automatically
                const currentStatus = calculateSubtaskStatus(subtask);
                
                return (
                  <tr 
                    key={subtask.id} 
                    id={`subtask-row-${subtask.id}`}
                    className={cn(
                      "group transition-all duration-300",
                      isEditing ? "bg-indigo-50/50" : "hover:bg-slate-50/50",
                      isReadOnly && !isEditing && "bg-slate-50/30",
                      targetSubtaskId === subtask.id && "ring-2 ring-indigo-500 bg-indigo-50/80 font-bold shadow-md"
                    )}
                  >
                    <td className={cn(
                      "px-6 py-4 transition-all",
                      isEditing && "border-l-4 border-indigo-600"
                    )}>
                      {isEditing ? (
                        <input 
                          value={tempSubtaskData?.title || ''}
                          onChange={(e) => setTempSubtaskData(prev => prev ? { ...prev, title: e.target.value } : null)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                          placeholder="Título da subtarefa..."
                          autoFocus
                        />
                      ) : (
                        <div 
                          className="relative inline-block"
                          onMouseEnter={(e) => handleMouseEnterSubtask(e, subtask.id)}
                          onMouseLeave={handleMouseLeaveSubtask}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "font-bold transition-colors",
                              isReadOnly ? "text-slate-400" : "text-slate-700"
                            )}>
                              {subtask.title}
                            </span>
                            {/* Actions Badge Indicator */}
                            {(() => {
                              const subtaskActions = (actions || []).filter(a => a.subtaskId === subtask.id);
                              if (subtaskActions.length === 0) return null;
                              
                              const hasLate = subtaskActions.some(a => calculateActionAlert(a) === 'Atrasado');
                              const allCompleted = subtaskActions.every(a => a.status === 'Concluído');
                              
                              let dotColor = 'bg-amber-500';
                              let textColor = 'text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-500/20';
                              let bgColor = 'bg-amber-50 dark:bg-amber-500/10';
                              
                              if (hasLate) {
                                dotColor = 'bg-red-500';
                                textColor = 'text-red-700 dark:text-red-400 border-red-200/50 dark:border-red-500/20';
                                bgColor = 'bg-red-50 dark:bg-red-500/10';
                              } else if (allCompleted) {
                                dotColor = 'bg-emerald-500';
                                textColor = 'text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20';
                                bgColor = 'bg-emerald-50 dark:bg-emerald-500/10';
                              }
                              
                              return (
                                <div className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black shadow-sm select-none transition-all",
                                  textColor, bgColor
                                )}>
                                  <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", dotColor)} />
                                  <span>{subtaskActions.length}</span>
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {subtask.pdcaCycles.length} Ciclos PDCA
                            </span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <select 
                          value={tempSubtaskData?.priority || 'Média'}
                          onChange={(e) => setTempSubtaskData(prev => prev ? { ...prev, priority: e.target.value as any } : null)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        >
                          <option value="Alta">Alta</option>
                          <option value="Média">Média</option>
                          <option value="Baixa">Baixa</option>
                        </select>
                      ) : (
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                          subtask.priority === 'Alta' ? "bg-rose-100 text-rose-600" :
                          subtask.priority === 'Média' ? "bg-indigo-100 text-indigo-600" :
                          "bg-slate-200 text-slate-600"
                        )}>
                          {subtask.priority}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap",
                        currentStatus === 'Concluído' ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                        currentStatus === 'Em andamento' ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400" :
                        "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      )}>
                        {currentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <select 
                          value={tempSubtaskData?.responsibleId || ''}
                          onChange={(e) => setTempSubtaskData(prev => prev ? { ...prev, responsibleId: e.target.value } : null)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        >
                          <option value="">Sem Responsável</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs font-medium text-slate-600">
                          {users.find(u => u.id === subtask.responsibleId)?.name || 'Sem Responsável'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button 
                              onClick={() => {
                                if (tempSubtaskData) {
                                  const updatedSub = { 
                                    ...subtask, 
                                    title: tempSubtaskData.title,
                                    priority: tempSubtaskData.priority,
                                    responsibleId: tempSubtaskData.responsibleId
                                  };
                                  if (tempSubtaskData.responsibleId && tempSubtaskData.responsibleId !== subtask.responsibleId) {
                                    notifySubtaskChanges(project.id, project.name, subtask, updatedSub, auth.currentUser?.uid);
                                  }
                                  const updatedSubtasks = (project.subtasks || []).map(s => 
                                    s.id === subtask.id ? updatedSub : s
                                  );
                                  setProjects({ ...project, subtasks: updatedSubtasks });
                                }
                                setEditingSubtask(null);
                                setTempSubtaskData(null);
                              }}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Salvar"
                            >
                              <Save size={18} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingSubtask(null);
                                setTempSubtaskData(null);
                              }}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                              title="Cancelar"
                            >
                              <X size={18} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => onSelectSubtask(subtask.id)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Executar Mapeamento e PDCA"
                            >
                              <ArrowRight size={18} />
                            </button>
                            
                            {/* Edição permitida em qualquer status exceto concluído para Analista/Master */}
                            {profile !== 'Usuário Visualizador' && currentStatus !== 'Concluído' && (
                              <button 
                                onClick={() => {
                                  setEditingSubtask(subtask.id);
                                  setTempSubtaskData({
                                    title: subtask.title,
                                    priority: subtask.priority,
                                    responsibleId: subtask.responsibleId
                                  });
                                }}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                title="Editar Subtarefa"
                              >
                                <Edit size={18} />
                              </button>
                            )}

                            <button 
                              onClick={() => setSubtaskToDelete(subtask.id)}
                              className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                              title="Excluir Subtarefa"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
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
                          src="/assets/logo-gipflow.svg" 
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
        {subtaskToDelete && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSubtaskToDelete(null)}
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
              <h3 className="text-xl font-black text-slate-900 mb-2">Excluir Subtarefa</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                Deseja realmente excluir esta subtarefa? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setSubtaskToDelete(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all font-sans"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    deleteSubtask(subtaskToDelete);
                    setSubtaskToDelete(null);
                  }}
                  className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 font-sans"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      {/* Floating Hover Tooltip/Popover */}
      <AnimatePresence>
        {hoveredSubtaskActionsId && hoveredSubtaskRect && (
          <SubtaskActionsTooltip 
            rect={hoveredSubtaskRect} 
            actions={actions} 
            subtaskId={hoveredSubtaskActionsId} 
          />
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
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 min-h-[120px] outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm leading-relaxed"
        />
      ) : (
        <input 
          type={type}
          value={value || ''}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
        />
      )}
    </div>
  );
}

// --- MODALS ---

function CreateProjectModal({ isOpen, onClose, onCreate, users }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onCreate: (data: { name: string, description: string, priority: ProjectPriority, assignedTo: string }) => void,
  users: User[]
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('Média');
  const [assignedTo, setAssignedTo] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setPriority('Média');
      setAssignedTo(users.length > 0 ? users[0].id : '');
    }
  }, [isOpen, users]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-theme-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-theme-border"
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
              <label className="text-sm font-semibold text-slate-700 ml-1">Descrição do projeto</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 300))}
                placeholder="Descreva brevemente o objetivo deste projeto..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all h-24 resize-none"
              />
              <div className="flex justify-end pr-1">
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest",
                  description.length >= 300 ? "text-rose-500" : "text-slate-400"
                )}>
                  {description.length}/300
                </span>
              </div>
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
                <option value="backlog">Backlog</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            disabled={!name.trim()}
            onClick={() => onCreate({ name, description, priority, assignedTo })}
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
  globalConfig: GlobalConfig, 
  projects: Project[],
  actions: OperationalAction[],
  key?: string 
}) {
  const currentUserProfile = users.find(u => u.id === auth.currentUser?.uid);
  const profile = currentUserProfile?.profile || 'Usuário Analista';

  // Determine permitted menu items
  const menuItems = [
    ...(profile === 'Usuário Master' ? [{ id: 'cadastros', label: 'Cadastros', icon: <Users size={18} /> }] : []),
    ...(profile !== 'Usuário Visualizador' ? [
      { 
        id: 'setores-ferramentas', 
        label: 'Setores e Ferramentas', 
        icon: <Settings size={18} /> 
      },
      { id: 'ganhos', label: 'Tipos de Ganhos', icon: <TrendingUp size={18} /> }
    ] : []),
    { id: 'relatorios', label: 'Relatórios', icon: <FileText size={18} /> },
    { id: 'alterar-senha', label: 'Alterar Senha', icon: <Lock size={18} /> }
  ] as const;

  const defaultSubTab = profile === 'Usuário Visualizador' 
    ? 'relatorios' 
    : (profile === 'Usuário Analista' ? 'setores-ferramentas' : 'cadastros');

  const [activeSubTab, setActiveSubTab] = useState<'cadastros' | 'setores-ferramentas' | 'relatorios' | 'ganhos' | 'alterar-senha'>(defaultSubTab);

  useEffect(() => {
    setActiveSubTab(defaultSubTab);
  }, [profile]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full min-h-[600px]">
      {/* Sidebar Fixa */}
      <div className="w-full lg:w-[260px] lg:min-w-[260px] shrink-0">
        <div className="sticky top-0 lg:top-8 space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Configurações</h2>
            <p className="text-slate-500 mt-1 text-sm">Gerencie as preferências do sistema e cadastros.</p>
          </div>

          <nav className="bg-white p-2 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-1">
            {menuItems.map((item) => (
              <button 
                key={item.id}
                onClick={() => setActiveSubTab(item.id)}
                className={cn(
                  "px-4 py-3 rounded-2xl transition-all font-bold text-sm flex items-center gap-3 w-full text-left",
                  activeSubTab === item.id 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                )}
              >
                <span className={cn("transition-colors", activeSubTab === item.id ? "text-white" : "text-slate-400 group-hover:text-slate-600")}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {activeSubTab === item.id && (
                  <motion.div 
                    layoutId="active-pill"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-50"
                  />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Área de Conteúdo Dinâmico */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeSubTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            {activeSubTab === 'cadastros' && <UserRegistrationTab users={users} currentUser={users.find(u => u.id === auth.currentUser?.uid)} />}
            {activeSubTab === 'setores-ferramentas' && <GlobalConfigTab config={globalConfig} />}
            {activeSubTab === 'ganhos' && <GainTypesTab config={globalConfig} />}
            {activeSubTab === 'relatorios' && (
              <ReportsTab projects={projects} users={users} actions={actions} />
            )}
            {activeSubTab === 'alterar-senha' && <ChangePasswordTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}


interface ConfigSectionProps {
  title: string;
  description: string;
  items: string[];
  newValue: string;
  setNewValue: (v: string) => void;
  field: string;
  placeholder: string;
  onUpdate: (updates: any) => Promise<void>;
}

const ConfigSection = ({ title, description, items, newValue, setNewValue, field, placeholder, onUpdate }: ConfigSectionProps) => (
  <div className="space-y-6">
    <div>
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="text-slate-500 text-sm mt-1">{description}</p>
    </div>
    <div className="flex gap-2">
      <input 
        value={newValue}
        onChange={(e) => setNewValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const trimmed = newValue.trim();
            if (trimmed && !items.includes(trimmed)) {
              onUpdate({ [field]: [...items, trimmed] });
              setNewValue('');
            }
          }
        }}
        placeholder={placeholder}
        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button 
        onClick={() => {
          const trimmed = newValue.trim();
          if (trimmed && !items.includes(trimmed)) {
            onUpdate({ [field]: [...items, trimmed] });
            setNewValue('');
          }
        }}
        className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all"
      >
        Adicionar
      </button>
    </div>
    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
      {items.map((item, idx) => (
        <div key={`${item}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group hover:border-indigo-200 transition-all">
          <span className="text-sm font-medium text-slate-700">{item}</span>
          <button 
            onClick={() => onUpdate({ [field]: items.filter(i => i !== item) })}
            className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center py-4 border-2 border-dashed border-slate-100 rounded-xl">
          Vazio
        </p>
      )}
    </div>
  </div>
);

function GlobalConfigTab({ config }: { 
  config: GlobalConfig
}) {
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
    <div className="p-8 space-y-12 w-full overflow-y-auto max-h-[85vh] custom-scrollbar">
      <div className="flex items-center gap-4 border-b border-slate-100 pb-8">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
          <Settings size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 leading-tight">Geral e Processos</h3>
          <p className="text-slate-500 text-sm mt-1">Gerencie os parâmetros globais do sistema de processos.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <ConfigSection 
          title="Setores" 
          description="Gerencie os setores disponíveis para seleção."
          items={config.sectors || []}
          newValue={newSector}
          setNewValue={setNewSector}
          field="sectors"
          placeholder="Novo setor..."
          onUpdate={updateConfig}
        />
        <ConfigSection 
          title="Ferramentas" 
          description="Gerencie as ferramentas disponíveis para seleção."
          items={config.tools || []}
          newValue={newTool}
          setNewValue={setNewTool}
          field="tools"
          placeholder="Nova ferramenta..."
          onUpdate={updateConfig}
        />
      </div>
    </div>
  );
}

function GainTypesTab({ config }: { config: GlobalConfig }) {
  const [activeTab, setActiveTab] = useState<'tangible' | 'intangible' | 'unit'>('tangible');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TangibleGainType | IntangibleGainType | UnitMeasure | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]); // Used for tangible gain type
  const [symbol, setSymbol] = useState(''); // Used for unit measure
  const [description, setDescription] = useState(''); // Used for unit measure description
  const [active, setActive] = useState(true);

  // Deletion confirmation state
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (editingItem) {
      setName((editingItem as any).name || '');
      setSelectedUnits((editingItem as TangibleGainType).units || ((editingItem as any).unit ? [(editingItem as any).unit] : []));
      setSymbol((editingItem as UnitMeasure).symbol || '');
      setDescription((editingItem as UnitMeasure).description || '');
      setActive(editingItem.active);
    } else {
      setName('');
      setSelectedUnits([]);
      setSymbol('');
      setDescription('');
      setActive(true);
    }
  }, [editingItem, isModalOpen]);

  const updateConfig = async (updates: any) => {
    try {
      await setDoc(doc(db, 'config', 'global'), { ...config, ...updates }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'config/global');
    }
  };

  const handleDelete = async () => {
    if (!idToDelete) return;

    if (activeTab === 'tangible') {
      const next = (config.structuredTangibleGains || []).filter(i => i.id !== idToDelete);
      await updateConfig({ structuredTangibleGains: next });
    } else if (activeTab === 'intangible') {
      const next = (config.structuredIntangibleGains || []).filter(i => i.id !== idToDelete);
      await updateConfig({ structuredIntangibleGains: next });
    } else {
      const next = (config.structuredUnits || []).filter(i => i.id !== idToDelete);
      await updateConfig({ structuredUnits: next });
    }
    setIdToDelete(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab !== 'unit' && !name) return;
    if (activeTab === 'unit' && !symbol) return;

    if (activeTab === 'tangible') {
      const current = config.structuredTangibleGains || [];
      const data: TangibleGainType = { id: editingItem?.id || uuidv4(), name, units: selectedUnits, active };
      let next: TangibleGainType[];
      if (editingItem) {
        next = current.map(item => item.id === editingItem.id ? data : item);
      } else {
        next = [...current, data];
      }
      await updateConfig({ structuredTangibleGains: next });
    } else if (activeTab === 'intangible') {
      const current = config.structuredIntangibleGains || [];
      const data = { id: editingItem?.id || uuidv4(), name, active };
      let next: IntangibleGainType[];
      if (editingItem) {
        next = current.map(item => item.id === editingItem.id ? data : item);
      } else {
        next = [...current, data];
      }
      await updateConfig({ structuredIntangibleGains: next });
    } else {
      const current = config.structuredUnits || [];
      const data = { id: editingItem?.id || uuidv4(), symbol, description, active };
      let next: UnitMeasure[];
      if (editingItem) {
        next = current.map(item => item.id === editingItem.id ? data : item);
      } else {
        next = [...current, data];
      }
      await updateConfig({ structuredUnits: next });
    }

    setIsModalOpen(false);
    setEditingItem(null);
  };

  const toggleStatus = async (item: TangibleGainType | IntangibleGainType | UnitMeasure) => {
    if (activeTab === 'tangible') {
      const next = (config.structuredTangibleGains || []).map(i => i.id === item.id ? { ...i, active: !i.active } : i);
      await updateConfig({ structuredTangibleGains: next });
    } else if (activeTab === 'intangible') {
      const next = (config.structuredIntangibleGains || []).map(i => i.id === item.id ? { ...i, active: !i.active } : i);
      await updateConfig({ structuredIntangibleGains: next });
    } else {
      const next = (config.structuredUnits || []).map(i => i.id === item.id ? { ...i, active: !i.active } : i);
      await updateConfig({ structuredUnits: next });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/30">
      <div className="p-8 border-b border-slate-100 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
              <TrendingUp size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 leading-tight">Tipos de Ganhos</h3>
              <p className="text-slate-500 text-sm mt-1">Configure os tipos de ganhos para uso no PDCA.</p>
            </div>
          </div>
          
          <button 
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            <Plus size={18} />
            {activeTab === 'tangible' ? 'Novo Ganho Tangível' : activeTab === 'intangible' ? 'Novo Ganho Intangível' : 'Nova Unidade'}
          </button>
        </div>

        <div className="flex gap-2 mt-8 p-1 bg-slate-100 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('tangible')}
            className={cn(
              "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'tangible' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Tangíveis
          </button>
          <button 
            onClick={() => setActiveTab('intangible')}
            className={cn(
              "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'intangible' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Intangíveis
          </button>
          <button 
            onClick={() => setActiveTab('unit')}
            className={cn(
              "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              activeTab === 'unit' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            Unidades de Medida
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                {activeTab === 'unit' ? (
                  <>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sigla</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome</th>
                    {activeTab === 'tangible' && (
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade</th>
                    )}
                  </>
                )}
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activeTab === 'tangible' ? (
                (config.structuredTangibleGains || []).length > 0 ? (
                  config.structuredTangibleGains?.map(item => (
                    <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-700">{item.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {item.units && item.units.length > 0 ? item.units.map((u, uIdx) => (
                            <span key={`${u}-${uIdx}`} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">{u}</span>
                          )) : <span className="text-[10px] text-slate-400">Nenhuma</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                          item.active 
                            ? "bg-emerald-50 text-emerald-600" 
                            : "bg-slate-100 text-slate-400 line-through"
                        )}>
                          {item.active ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {item.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => toggleStatus(item)}
                            title={item.active ? 'Inativar' : 'Ativar'}
                            className={cn(
                              "p-2 rounded-xl transition-all",
                              item.active ? "text-slate-400 hover:text-rose-500 hover:bg-rose-50" : "text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50"
                            )}
                          >
                            {item.active ? <XCircle size={18} /> : <CheckCircle size={18} />}
                          </button>
                          <button 
                            onClick={() => {
                              setEditingItem(item);
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => setIdToDelete(item.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Zap size={32} strokeWidth={1} />
                        <span className="text-sm font-medium">Nenhum ganho tangível cadastrado</span>
                      </div>
                    </td>
                  </tr>
                )
              ) : activeTab === 'intangible' ? (
                (config.structuredIntangibleGains || []).length > 0 ? (
                  config.structuredIntangibleGains?.map(item => (
                    <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-700">{item.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                          item.active 
                            ? "bg-emerald-50 text-emerald-600" 
                            : "bg-slate-100 text-slate-400 line-through"
                        )}>
                          {item.active ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {item.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => toggleStatus(item)}
                            title={item.active ? 'Inativar' : 'Ativar'}
                            className={cn(
                              "p-2 rounded-xl transition-all",
                              item.active ? "text-slate-400 hover:text-rose-500 hover:bg-rose-50" : "text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50"
                            )}
                          >
                            {item.active ? <XCircle size={18} /> : <CheckCircle size={18} />}
                          </button>
                          <button 
                            onClick={() => {
                              setEditingItem(item);
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => setIdToDelete(item.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Award size={32} strokeWidth={1} />
                        <span className="text-sm font-medium">Nenhum ganho intangível cadastrado</span>
                      </div>
                    </td>
                  </tr>
                )
              ) : (
                (config.structuredUnits || []).length > 0 ? (
                  config.structuredUnits?.map(item => (
                    <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">{item.symbol}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-600">{item.description || '-'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                          item.active 
                            ? "bg-emerald-50 text-emerald-600" 
                            : "bg-slate-100 text-slate-400 line-through"
                        )}>
                          {item.active ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {item.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => toggleStatus(item)}
                            title={item.active ? 'Inativar' : 'Ativar'}
                            className={cn(
                              "p-2 rounded-xl transition-all",
                              item.active ? "text-slate-400 hover:text-rose-500 hover:bg-rose-50" : "text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50"
                            )}
                          >
                            {item.active ? <XCircle size={18} /> : <CheckCircle size={18} />}
                          </button>
                          <button 
                            onClick={() => {
                              setEditingItem(item);
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => setIdToDelete(item.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Globe size={32} strokeWidth={1} />
                        <span className="text-sm font-medium">Nenhuma unidade de medida cadastrada</span>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Sidebar Formulário */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[101] flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingItem ? 'Editar Tipo de Ganho' : 'Novo Tipo de Ganho'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 p-8 space-y-6 overflow-y-auto">
                {activeTab !== 'unit' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nome do tipo de ganho</label>
                    <input 
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Redução de Custos"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                    />
                  </div>
                )}

                {activeTab === 'tangible' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Unidades de medida vinculadas</label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                      {(config.structuredUnits?.filter(u => u.active).map(u => u.symbol) || config.units || []).map((u, uIdx) => {
                        const isSelected = selectedUnits.includes(u);
                        return (
                          <label 
                            key={`${u}-${uIdx}`} 
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
                              isSelected 
                                ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" 
                                : "bg-white border-transparent text-slate-500 hover:bg-slate-100"
                            )}
                          >
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  setSelectedUnits(selectedUnits.filter(curr => curr !== u));
                                } else {
                                  setSelectedUnits([...selectedUnits, u]);
                                }
                              }}
                              className="hidden"
                            />
                            <div className={cn(
                              "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                              isSelected ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-200"
                            )}>
                              {isSelected && <Check size={12} className="text-white" />}
                            </div>
                            <span className="text-sm font-bold">{u}</span>
                          </label>
                        );
                      })}
                      {(config.structuredUnits?.filter(u => u.active).length || 0) === 0 && (
                        <div className="col-span-2 py-4 text-center text-slate-400 text-xs italic">
                          Nenhuma unidade cadastrada. Cadastre em "Unidades de Medida" primeiro.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'unit' && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Sigla (Obrigatório)</label>
                      <input 
                        required
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        placeholder="Ex: R$, %, h"
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Descrição (Opcional)</label>
                      <input 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Ex: Reais"
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-4 pt-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Status</label>
                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setActive(true)}
                      className={cn(
                        "flex-1 p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 font-bold text-sm",
                        active ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      <CheckCircle size={18} />
                      Ativo
                    </button>
                    <button 
                      type="button"
                      onClick={() => setActive(false)}
                      className={cn(
                        "flex-1 p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 font-bold text-sm",
                        !active ? "bg-rose-50 border-rose-500 text-rose-700" : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                      )}
                    >
                      <XCircle size={18} />
                      Inativo
                    </button>
                  </div>
                </div>
              </form>

              <div className="p-8 border-t border-slate-100 flex gap-4 bg-slate-50/50">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 px-6 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-white transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 py-4 px-6 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Confirmação de Exclusão */}
      <AnimatePresence>
        {idToDelete && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIdToDelete(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110]"
            />
            <div className="fixed inset-0 flex items-center justify-center p-4 z-[111]">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl border border-slate-100 space-y-6"
              >
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                  <Trash2 size={32} />
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Confirmar exclusão?</h3>
                  <p className="text-slate-500 text-sm">
                    Deseja realmente excluir este registro? Essa ação não poderá ser desfeita.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setIdToDelete(null)}
                    className="flex-1 py-4 px-6 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all text-sm"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="flex-1 py-4 px-6 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 text-sm"
                  >
                    Confirmar exclusão
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserRegistrationTab({ users, currentUser }: { users: User[], currentUser?: User }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sector, setSector] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<UserProfile>('Usuário Analista');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showMasterAlertModal, setShowMasterAlertModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isEditingUserPasswordDisabled, setIsEditingUserPasswordDisabled] = useState(true);

  // Fallback check for admin email just in case the profile isn't loaded yet in state
  const isMaster = currentUser?.profile === 'Usuário Master';

  useEffect(() => {
    if (editingUser) {
      setName(editingUser.name);
      setEmail(editingUser.email || '');
      setSector(editingUser.sector || '');
      setProfile(editingUser.profile || 'Usuário Analista');
      setPassword('');
      setIsEditingUserPasswordDisabled(true);
      setShowPassword(false);
    } else {
      setName('');
      setEmail('');
      setSector('');
      setProfile('Usuário Analista');
      setPassword('');
      setIsEditingUserPasswordDisabled(false);
      setShowPassword(false);
    }
  }, [editingUser]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !sector) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (!editingUser && !password) {
      alert('Por favor, defina uma senha para o novo usuário.');
      return;
    }

    if (editingUser && !isEditingUserPasswordDisabled && !password) {
      alert('Por favor, digite a nova senha ou desmarque a opção de alteração.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const emailLower = email.trim().toLowerCase();
      const duplicate = users.find(u => u.email?.trim().toLowerCase() === emailLower);
      if (duplicate && (!editingUser || editingUser.id !== duplicate.id)) {
        alert('Este e-mail já está cadastrado no sistema!');
        setIsSubmitting(false);
        return;
      }

      const userId = editingUser ? editingUser.id : uuidv4();
      const userData: User = {
        id: userId,
        name,
        email,
        sector,
        profile,
        ...((!editingUser || !isEditingUserPasswordDisabled) && password ? { password } : {})
      };

      await setDoc(doc(db, 'users', userId), userData, { merge: true });
      
      setName('');
      setEmail('');
      setSector('');
      setPassword('');
      setProfile('Usuário Analista');
      setEditingUser(null);
      alert(editingUser ? 'Usuário atualizado com sucesso!' : 'Usuário cadastrado com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!user) return;

    if (!isMaster) {
      window.alert('Você não tem permissão para excluir usuários.');
      return;
    }

    if (
      user.profile === 'Usuário Master' || 
      user.profile?.toUpperCase() === 'MASTER' || 
      (user as any).role === 'MASTER'
    ) {
      setShowMasterAlertModal(true);
      return;
    }

    setUserToDelete(user);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    if (
      userToDelete.profile === 'Usuário Master' || 
      userToDelete.profile?.toUpperCase() === 'MASTER' || 
      (userToDelete as any).role === 'MASTER'
    ) {
      setShowMasterAlertModal(true);
      setUserToDelete(null);
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      setUserToDelete(null);
      window.alert('Usuário excluído com sucesso!');
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      window.alert('Erro ao excluir usuário');
    }
  };

  const handleChangeProfile = async (userId: string, newProfile: UserProfile) => {
    if (!isMaster) {
      window.alert('Você não tem permissão para alterar perfis.');
      return;
    }

    try {
      await setDoc(doc(db, 'users', userId), { profile: newProfile }, { merge: true });
      // Se estiver editando este usuário, atualize o estado local do formulário também
      if (editingUser?.id === userId) {
        setProfile(newProfile);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
    }
  };

  return (
    <div className="p-6 space-y-12 w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">
                Senha
              </label>
              <div className="relative flex items-center">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? '••••••••' : 'Defina uma senha'}
                  required={!editingUser && !isEditingUserPasswordDisabled}
                  disabled={editingUser ? isEditingUserPasswordDisabled : false}
                  minLength={6}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all disabled:opacity-60"
                />
                {((!editingUser || !isEditingUserPasswordDisabled) && password) ? (
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                ) : null}
              </div>
              {editingUser && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="change-password-toggle"
                      checked={!isEditingUserPasswordDisabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsEditingUserPasswordDisabled(!checked);
                        if (!checked) {
                          setPassword('');
                          setShowPassword(false);
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="change-password-toggle" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                      Alterar senha deste colaborador
                    </label>
                  </div>
                  <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 p-2 rounded-lg flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                    <span>
                      {editingUser.lastPasswordChange ? (
                        <>Senha definida • Última alteração: <strong>{new Date(editingUser.lastPasswordChange).toLocaleString('pt-BR')}</strong></>
                      ) : (
                        "Senha definida"
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 ml-1">Perfil</label>
              <select 
                value={profile}
                onChange={(e) => setProfile(e.target.value as UserProfile)}
                disabled={!isMaster}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="Usuário Analista">Usuário Analista</option>
                <option value="Usuário Master">Usuário Master</option>
                <option value="Usuário Visualizador">Usuário Visualizador</option>
              </select>
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
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs ring-4 ring-white">
                    {u.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate">{u.name}</p>
                      <span className={cn(
                        "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider",
                        (u.profile || 'Usuário Analista') === 'Usuário Master' ? "bg-indigo-100 text-indigo-700" : 
                        (u.profile || 'Usuário Analista') === 'Usuário Visualizador' ? "bg-emerald-100 text-emerald-700" :
                        "bg-slate-200 text-slate-600"
                      )}>
                        {u.profile || 'Usuário Analista'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate uppercase tracking-wider font-medium">{u.sector || 'Setor não informado'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        console.log('Botão editar clicado:', u.id);
                        setEditingUser(u);
                      }}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="Editar"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('CLIQUE NO BOTÃO EXCLUIR OK - ID:', u.id);
                        handleDeleteUser(u);
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all relative z-[9999] pointer-events-auto cursor-pointer"
                      style={{ isolation: 'isolate' }}
                      title="Excluir"
                    >
                      <Trash2 size={16} style={{ pointerEvents: 'none' }} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUserToDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                  <Trash2 size={32} />
                </div>
                <h4 className="text-xl font-bold text-slate-900 text-center mb-2">Excluir Usuário</h4>
                <p className="text-slate-500 text-center mb-8">
                  Deseja realmente excluir o usuário <span className="font-bold text-slate-700">{userToDelete.name}</span>? Esta ação não pode ser desfeita.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setUserToDelete(null)}
                    className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 px-6 py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
                  >
                    Sim, Excluir
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showMasterAlertModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMasterAlertModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                  <AlertCircle size={32} />
                </div>
                <h4 className="text-xl font-bold text-slate-900 text-center mb-2">Ação não permitida</h4>
                <p className="text-slate-500 text-center mb-8">
                  Não é possível excluir um usuário com perfil MASTER.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowMasterAlertModal(false)}
                    className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg text-center"
                  >
                    Entendi
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

function ChangePasswordTab() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMsg('Por favor, preencha todos os campos.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('A nova senha e a confirmação não coincidem.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: auth.currentUser?.uid,
          currentPassword,
          newPassword
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao alterar a senha.');
      }

      setSuccessMsg('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao alterar a senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-12 w-full overflow-y-auto max-h-[85vh] custom-scrollbar">
      <div className="flex items-center gap-4 border-b border-slate-100 pb-8">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
          <Lock size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 leading-tight">Alterar Senha</h3>
          <p className="text-slate-500 text-sm mt-1">Mantenha sua conta segura alterando sua senha periodicamente.</p>
        </div>
      </div>

      <div className="max-w-md space-y-6">
        {errorMsg && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-4 rounded-2xl font-bold">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 p-4 rounded-2xl font-bold">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">Senha Atual</label>
            <input 
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite sua senha atual"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">Nova Senha (mín. 6 caracteres)</label>
            <input 
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Digite a nova senha"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">Confirmar Nova Senha</label>
            <input 
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirme a nova senha"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <button 
            type="submit"
            disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            {isSubmitting ? 'Alterando...' : 'Alterar Senha'}
          </button>
        </form>
      </div>
    </div>
  );
}

function PDCATab({ 
  project, 
  subtask, 
  onUpdateSubtask,
  selectedTaskId,
  globalConfig
}: { 
  project: Project, 
  subtask: Subtask,
  onUpdateSubtask: (s: Subtask) => void,
  selectedTaskId?: string | null,
  globalConfig: GlobalConfig
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
          globalConfig={globalConfig}
          userProfile={auth.currentUser?.profile}
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
