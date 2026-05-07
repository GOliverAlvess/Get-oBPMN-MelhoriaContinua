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
  Moon
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
  InnovationProject,
  InnovationLog,
  InnovationConfig,
  GlobalConfig,
  TangibleGainType,
  IntangibleGainType,
  UnitMeasure
} from './types';
import { cn, isValidUrl, formatUrl, cleanObject } from './lib/utils';
import MappingTab from './components/MappingTab';
import PDCAEditor from './components/PDCAEditor';
import DashboardView from './components/DashboardView';
import OperationalActionsTab from './components/OperationalActionsTab';
import ReportsTab from './components/ReportsTab';
import InnovationReportsTab from './components/InnovationReportsTab';
import ProjectFilesSection from './components/ProjectFilesSection';
import InnovationView from './components/InnovationView';
import InnovationDashboardView from './components/InnovationDashboardView';
import { calculateProjectProgress, calculateProjectStatus, calculateSubtaskStatus } from './lib/projectUtils';

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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('flowprocess_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('flowprocess_theme', theme);
  }, [theme]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scope' | 'mapping' | 'pdca'>('scope');
  const [activeView, setActiveView] = useState<'kanban' | 'settings' | 'dashboard' | 'actions' | 'home' | 'innovation'>('home');
  const [mode, setMode] = useState<'processos' | 'inovacao' | null>(localStorage.getItem('flowprocess_mode') as any || null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [operationalActions, setOperationalActions] = useState<OperationalAction[]>([]);
  const [innovationProjects, setInnovationProjects] = useState<InnovationProject[]>([]);
  const [innovationConfig, setInnovationConfig] = useState<InnovationConfig>({ technologies: [] });
  const [targetSubtaskId, setTargetSubtaskId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({ 
    sectors: [], 
    tools: [],
    tangibleGainTypes: [],
    intangibleGainTypes: [],
    units: ['R$ (Reais)', 'Horas', '% (Percentual)', 'Unidades']
  });
  const [bpmnSavedColors, setBpmnSavedColors] = useState<SavedColor[]>([]);

  const [hasChanges, setHasChanges] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigationAction, setPendingNavigationAction] = useState<(() => void) | null>(null);

  const handleNavigation = (action: () => void) => {
    if (hasChanges) {
      setPendingNavigationAction(() => action);
      setShowUnsavedModal(true);
    } else {
      action();
    }
  };

  const currentUserProfile = users.find(u => u.id === user?.uid);

  // Listen for Module Restrictions
  useEffect(() => {
    if (user && currentUserProfile) {
      // If user is restricted to a module but has a different one (or none) selected
      if (currentUserProfile.module) {
        if (mode !== currentUserProfile.module) {
          handleSelectMode(currentUserProfile.module);
        }
      }
    }
  }, [user, currentUserProfile, mode]);

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
      setProjects(projectsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'projects'));

    // Listen for Global Config
    const configUnsubscribe = onSnapshot(doc(db, 'config', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setGlobalConfig(snapshot.data() as any);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'config/global'));

    // Listen for Innovation Config
    const innovationConfigUnsubscribe = onSnapshot(doc(db, 'config', 'innovation'), (snapshot) => {
      if (snapshot.exists()) {
        setInnovationConfig(snapshot.data() as InnovationConfig);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'config/innovation'));

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

    // Listen for Innovation Projects
    const innovationUnsubscribe = onSnapshot(collection(db, 'innovationProjects'), (snapshot) => {
      const innovationData = snapshot.docs.map(doc => doc.data() as InnovationProject);
      setInnovationProjects(innovationData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'innovationProjects'));

    return () => {
      usersUnsubscribe();
      projectsUnsubscribe();
      configUnsubscribe();
      innovationConfigUnsubscribe();
      actionsUnsubscribe();
      colorsUnsubscribe();
      innovationUnsubscribe();
    };
  }, [user]);

  // Sync User Profile to Firestore
  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      const isAdminEmail = user.email === 'bielalves201@gmail.com';
      
      // Check if user already exists to avoid overwriting profile
      getDoc(userDocRef).then(docSnap => {
        if (!docSnap.exists()) {
          setDoc(userDocRef, {
            id: user.uid,
            name: user.displayName || 'Usuário sem nome',
            email: user.email || '',
            profile: isAdminEmail ? 'Usuário Master' : 'Usuário Analista'
          }).catch(error => handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`));
        } else {
          const data = docSnap.data();
          // If profile is missing or if it's the admin and not Master, upgrade it
          if (!data?.profile || (isAdminEmail && data.profile !== 'Usuário Master')) {
            setDoc(userDocRef, {
              profile: isAdminEmail ? 'Usuário Master' : (data?.profile || 'Usuário Analista')
            }, { merge: true }).catch(error => handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`));
          }
          
          // Always keep name and email updated
          setDoc(userDocRef, {
            id: user.uid,
            name: user.displayName || 'Usuário sem nome',
            email: user.email || '',
          }, { merge: true }).catch(error => handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`));
        }
      });
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

  const handleSelectMode = (m: 'processos' | 'inovacao') => {
    setMode(m);
    localStorage.setItem('flowprocess_mode', m);
    setActiveView('home');
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
        progress: calculateProjectProgress(projectToSync),
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
      setProjects(prev => prev.map(p => p.id === finalProject.id ? finalProject : p));
      
      const projectRef = doc(db, 'projects', finalProject.id);
      await setDoc(projectRef, cleanObject(finalProject));
      
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

  const handleAddInnovationProject = async (data: Omit<InnovationProject, 'id' | 'createdAt' | 'updatedAt'>) => {
    // Check for existing card with same actionId to prevent duplicates
    if (data.actionId) {
      const existing = innovationProjects.find(ip => ip.actionId === data.actionId && !ip.deleted);
      if (existing) {
        console.log("⚠️ [App] Innovation card already exists for this action plan. Returning existing ID:", existing.id);
        return existing.id;
      }
    }

    const newId = uuidv4();
    const responsibleUser = users.find(u => u.id === data.responsibleId);
    
    const newProject: InnovationProject = {
      ...data,
      id: newId,
      responsibleName: responsibleUser?.name || 'Sem Responsável',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'innovationProjects', newId), cleanObject(newProject));
      return newId;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `innovationProjects/${newId}`);
      throw error;
    }
  };

  const handleUpdateInnovationProject = async (id: string, updates: Partial<InnovationProject>) => {
    try {
      const innovationProject = innovationProjects.find(p => p.id === id);
      if (!innovationProject) return;

      const projectRef = doc(db, 'innovationProjects', id);
      await setDoc(projectRef, { 
        ...innovationProject, 
        ...updates,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `innovationProjects/${id}`);
    }
  };

  const handleDeleteInnovationProject = async (id: string) => {
    try {
      const innovationProject = innovationProjects.find(p => p.id === id);
      if (!innovationProject) return;

      // Soft delete in innovationProjects
      const projectRef = doc(db, 'innovationProjects', id);
      await setDoc(projectRef, { 
        ...innovationProject, 
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: user?.displayName || user?.email || 'Sistema',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Update PDCA link and log
      if (innovationProject.projectId) {
        const pdcaProject = projects.find(p => p.id === innovationProject.projectId);
        if (pdcaProject) {
          let found = false;
          const updatedSubtasks = (pdcaProject.subtasks || []).map(sub => {
            const updatedCycles = (sub.pdcaCycles || []).map(cycle => {
              // If we have explicit pdcaId, only update that cycle. If not, check all.
              if (!innovationProject.pdcaId || cycle.id === innovationProject.pdcaId) {
                const updatedActions = (cycle.plan.actionPlan || []).map(action => {
                  // Only cancel if this specific card ID is the one linked in the PDCA action plan
                  if (action.innovationProjectId === id) {
                    found = true;
                    const newLog: InnovationLog = {
                      id: uuidv4(),
                      date: new Date().toISOString(),
                      action: 'Plano de ação cancelado via módulo de Inovações',
                      detalhes: 'O card vinculado a este plano de ação foi excluído no módulo de inovação',
                      cardTitulo: innovationProject.title,
                      responsible: user?.displayName || user?.email || 'Sistema',
                      origin: 'inovacao'
                    };
                    return {
                      ...action,
                      status: 'Cancelado',
                      ativo: false,
                      innovationLogs: [...(action.innovationLogs || []), newLog]
                    };
                  }
                  return action;
                });
                return { ...cycle, plan: { ...cycle.plan, actionPlan: updatedActions } };
              }
              return cycle;
            });
            return { ...sub, pdcaCycles: updatedCycles };
          });

          if (found) {
            await setDoc(doc(db, 'projects', pdcaProject.id), {
              ...pdcaProject,
              subtasks: updatedSubtasks,
              updatedAt: new Date().toISOString()
            }, { merge: true });
            console.log(`✅ [App] Plano de ação vinculado ao card ${id} marcado como Cancelado.`);
          } else {
            console.warn(`⚠️ [App] Plano de ação vinculado ao card ${id} não encontrado no projeto ${innovationProject.projectId}.`);
          }
        } else {
          console.warn(`⚠️ [App] Projeto PDCA ${innovationProject.projectId} não encontrado.`);
        }
      } else {
        console.warn(`⚠️ [App] Card de inovação ${id} não possui vínculo com Projeto PDCA.`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `innovationProjects/${id}`);
    }
  };

  const handleCreateProject = async (data: { name: string, description: string, priority: ProjectPriority, assignedTo: string }) => {
    if (!user) return;
    const newId = uuidv4();
    const assignedUser = users.find(u => u.id === data.assignedTo);
    
    const newProject: Project = {
      id: newId,
      name: data.name,
      description: data.description,
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
      console.log("⏳ Criando novo projeto no Firestore:", newId);
      await setDoc(doc(db, 'projects', newId), cleanObject(newProject));
      
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

  const handleProjectClick = (id: string) => {
    setSelectedProjectId(id);
    setActiveTab('scope');
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

  const canAccessProcessos = !currentUserProfile?.module || currentUserProfile.module === 'processos';
  const canAccessInovacao = !currentUserProfile?.module || currentUserProfile.module === 'inovacao';

  if (isAuthReady && user && !mode) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50 via-white to-slate-50">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-4xl space-y-12"
        >
          <div className="text-center space-y-4">
            <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 inline-block mb-4">
              <img 
                src="/assets/logo-flowprocess.svg" 
                alt="Logo" 
                className="h-16 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Bem-vindo ao FlowProcess</h1>
            <p className="text-slate-500 font-medium">Escolha o ambiente de trabalho que deseja acessar hoje.</p>
          </div>

          <div className={cn(
            "grid gap-8",
            canAccessProcessos && canAccessInovacao ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-lg mx-auto"
          )}>
            {canAccessProcessos && (
              <motion.button
                whileHover={{ scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectMode('processos')}
                className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/50 text-left space-y-6 group transition-all hover:border-indigo-500"
              >
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <RefreshCw size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900">Gestão de Processos</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">
                    Acesse o mapeamento completo, BPMN, PDCA e dashboards operacionais da empresa.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest pt-4">
                  Acessar Módulo
                  <ArrowRight size={16} />
                </div>
              </motion.button>
            )}

            {canAccessInovacao && (
              <motion.button
                whileHover={{ scale: 1.02, y: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectMode('inovacao')}
                className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/50 text-left space-y-6 group transition-all hover:border-emerald-500"
              >
                <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                  <Target size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900">Gestão de Inovações</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">
                    Gerencie projetos de PD&I, prototipagem, automações (RPA) e soluções tecnológicas.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-widest pt-4">
                  Acessar Inovações
                  <ArrowRight size={16} />
                </div>
              </motion.button>
            )}
          </div>

          <div className="text-center pt-8">
            <button 
              onClick={() => handleNavigation(handleLogout)}
              className="text-slate-400 font-bold hover:text-red-500 transition-colors flex items-center gap-2 mx-auto"
            >
              <LogOut size={18} />
              Sair da conta
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-theme-background text-theme-foreground font-sans transition-colors duration-300">
        {/* Theme Toggle Floating */}
        <div className="fixed top-4 right-4 z-[60] flex items-center gap-3">
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
        </div>

        {/* Sidebar */}
        <aside className={cn(
          "fixed left-0 top-0 h-full bg-theme-card border-r border-theme-border z-50 hidden lg:flex flex-col transition-all duration-300",
          isSidebarCollapsed ? "w-20" : "w-64"
        )}>
          <div className="p-4 border-b border-theme-border flex flex-col items-center gap-4 shrink-0">
            <div className="flex items-center justify-between w-full min-w-0">
              <div className={cn("flex items-center gap-3 overflow-hidden transition-all duration-300", isSidebarCollapsed ? "w-0 opacity-0" : "w-auto opacity-100 min-w-0 flex-1")}>
                <div className="w-auto h-10 bg-white rounded-xl flex items-center justify-center shadow-md border border-slate-100 p-1 flex-shrink-0 dark:bg-slate-100">
                  <img 
                    src="/assets/logo-flowprocess.svg" 
                    alt="Logo" 
                    style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h1 className="font-bold text-lg tracking-tight text-indigo-700 dark:text-indigo-400 whitespace-nowrap truncate">FlowProcess</h1>
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
                  src="/assets/logo-flowprocess.svg" 
                  alt="Logo" 
                  style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
            {mode === 'processos' && (
              <>
                <SidebarItem 
                  active={activeView === 'dashboard'}
                  onClick={() => handleNavigation(() => {
                    setActiveView('dashboard');
                    setSelectedProjectId(null);
                    setHasChanges(false);
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
                  })}
                  icon={<History size={20} />}
                  label="Histórico de Ações"
                  collapsed={isSidebarCollapsed}
                />
              </>
            )}
            
            {mode === 'inovacao' && (
              <>
                <SidebarItem 
                  active={activeView === 'innovation_dashboard'}
                  onClick={() => handleNavigation(() => {
                    setActiveView('innovation_dashboard');
                    setSelectedProjectId(null);
                    setHasChanges(false);
                  })}
                  icon={<LayoutDashboard size={20} />}
                  label="Dashboard"
                  collapsed={isSidebarCollapsed}
                />
                <SidebarItem 
                  active={activeView === 'innovation'}
                  onClick={() => handleNavigation(() => {
                    setActiveView('innovation');
                    setSelectedProjectId(null);
                    setHasChanges(false);
                  })}
                  icon={<Target size={20} />}
                  label="Projetos"
                  collapsed={isSidebarCollapsed}
                />
              </>
            )}

            <SidebarItem 
              active={activeView === 'settings'}
              onClick={() => handleNavigation(() => {
                setActiveView('settings');
                setHasChanges(false);
              })}
              icon={<Settings size={20} />}
              label="Configurações"
              collapsed={isSidebarCollapsed}
            />

            {(!currentUserProfile?.module) && (
              <div className="pt-4 mt-4 border-t border-slate-100 italic">
                <button 
                  onClick={() => handleNavigation(() => {
                    setMode(null);
                    localStorage.removeItem('flowprocess_mode');
                  })}
                  className="w-full flex items-center gap-2 p-3 text-slate-400 hover:text-indigo-600 transition-colors text-xs font-black uppercase tracking-widest"
                >
                  {!isSidebarCollapsed && <RefreshCw size={14} />}
                  {!isSidebarCollapsed && "Trocar Módulo"}
                  {isSidebarCollapsed && <RefreshCw size={18} />}
                </button>
              </div>
            )}
          </nav>

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
                      <p className="text-slate-400 text-lg font-medium tracking-wide">
                        {mode === 'inovacao' ? 'Gestão Inteligente de Inovações' : 'Gestão Inteligente de Processos'}
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
                mode={mode}
                innovationConfig={innovationConfig}
                onUpdateInnovationConfig={(config) => {
                  const configRef = doc(db, 'config', 'innovation');
                  setDoc(configRef, config).catch(e => handleFirestoreError(e, OperationType.WRITE, 'config/innovation'));
                }}
                innovationProjects={innovationProjects}
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
            ) : activeView === 'innovation_dashboard' ? (
              <InnovationDashboardView 
                key="innovation_dashboard"
                innovationProjects={innovationProjects}
                users={users}
              />
            ) : activeView === 'innovation' ? (
              <InnovationView 
                innovationProjects={innovationProjects}
                projects={projects}
                users={users}
                onDeleteInnovationProject={handleDeleteInnovationProject}
                onUpdateInnovationProject={handleUpdateInnovationProject}
                onAddInnovationProject={handleAddInnovationProject}
                bpmnSavedColors={bpmnSavedColors}
                onSaveBpmnColor={(color) => setBpmnSavedColors(prev => [...prev, color])}
                onDeleteBpmnColor={(id) => setBpmnSavedColors(prev => prev.filter(c => c.id !== id))}
                innovationConfig={innovationConfig}
                onUpdateInnovationConfig={(config) => {
                  const configRef = doc(db, 'config', 'innovation');
                  setDoc(configRef, config).catch(e => handleFirestoreError(e, OperationType.WRITE, 'config/innovation'));
                }}
                globalConfig={globalConfig}
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
                saveStatus={saveStatus}
                onAddInnovationProject={handleAddInnovationProject}
                onUpdateInnovationProject={handleUpdateInnovationProject}
                innovationProjects={innovationProjects}
                initialSubtaskId={targetSubtaskId}
                onClearInitialSubtask={() => setTargetSubtaskId(null)}
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

function KanbanView({ projects, users, onProjectClick, onCreateProject, onDeleteProject }: { 
  projects: Project[], 
  users: User[], 
  onProjectClick: (id: string) => void,
  onCreateProject: () => void,
  onDeleteProject: (id: string) => void,
  key?: string
}) {
  const [groupBy, setGroupBy] = useState<'status' | 'collaborator'>('status');
  const [visibleStatuses, setVisibleStatuses] = useState<ProjectStatus[]>([]);
  const [visibleCollaborators, setVisibleCollaborators] = useState<string[]>([]);
  const [visibleParticipants, setVisibleParticipants] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const statuses: ProjectStatus[] = ['Planejamento', 'Em andamento', 'Em melhoria', 'Concluído'];

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

  const filteredProjects = projects.map(p => ({ ...p, progress: calculateProjectProgress(p) })).filter(p => {
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
                            visibleParticipants.includes(u.id) ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                          )}>
                            {u.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className={cn(
                            "text-xs font-bold truncate",
                            visibleParticipants.includes(u.id) ? "text-indigo-600" : "text-slate-500"
                          )}>{u.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-between">
                    <button 
                      onClick={() => {
                        setVisibleStatuses([]);
                        setVisibleCollaborators([]);
                        setVisibleParticipants([]);
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
  onAddInnovationProject,
  onUpdateInnovationProject,
  innovationProjects = [],
  initialSubtaskId,
  onClearInitialSubtask
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
  onAddInnovationProject?: (data: any) => Promise<string>,
  onUpdateInnovationProject?: (id: string, updates: Partial<InnovationProject>) => Promise<void>,
  innovationProjects?: InnovationProject[],
  initialSubtaskId?: string | null,
  onClearInitialSubtask?: () => void,
  key?: string
}) {
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(initialSubtaskId || null);

  useEffect(() => {
    if (initialSubtaskId) {
      setSelectedSubtaskId(initialSubtaskId);
      if (onClearInitialSubtask) onClearInitialSubtask();
    }
  }, [initialSubtaskId, onClearInitialSubtask]);

  const selectedSubtask = project.subtasks?.find(s => s.id === selectedSubtaskId);

  const handleUpdateSubtask = (updatedSubtask: Subtask) => {
    // Inject automatic status
    const subtaskWithCalculatedStatus = {
      ...updatedSubtask,
      status: calculateSubtaskStatus(updatedSubtask)
    };
    const updatedSubtasks = (project.subtasks || []).map(s => s.id === subtaskWithCalculatedStatus.id ? subtaskWithCalculatedStatus : s);
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
        <div className="bg-theme-card border-b border-theme-border px-8 py-4 flex items-center justify-between sticky top-0 z-10 transition-colors">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setSelectedSubtaskId(null);
                setActiveTab('scope');
              }}
              className="p-2 hover:bg-theme-background rounded-lg transition-colors text-slate-400 flex items-center gap-2 font-bold text-sm"
            >
              <ChevronRight size={20} className="rotate-180" />
              Voltar ao Escopo
            </button>
            <div className="h-6 w-px bg-theme-border" />
            <div>
              <h3 className="text-lg font-bold text-theme-foreground">
                Execução: {selectedSubtask.title}
              </h3>
              <p className="text-xs text-slate-500 font-medium font-sans">Projeto: {project.scope.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-theme-background p-1 rounded-xl border border-theme-border">
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
              onAddInnovationProject={onAddInnovationProject}
              onUpdateInnovationProject={onUpdateInnovationProject}
              innovationProjects={innovationProjects}
              globalConfig={globalConfig}
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-theme-card rounded-lg transition-colors text-slate-400"
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
                className="text-2xl font-bold text-theme-foreground bg-transparent border-b border-transparent hover:border-theme-border focus:border-indigo-500 outline-none transition-all"
              />
              {isSaving && (
                <span className={cn(
                  "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest animate-pulse",
                  saveStatus === 'error' ? "text-rose-500" : "text-indigo-400"
                )}>
                  <RefreshCw size={10} className={cn(saveStatus === 'saving' && "animate-spin")} />
                  {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'success' ? 'Salvo!' : saveStatus === 'error' ? 'Erro!' : 'Salvando...'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
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

        <div className="flex items-center gap-6">
          <div className="hidden md:flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Progresso</span>
              <span className="text-lg font-black text-indigo-400">{calculateProjectProgress(project)}%</span>
            </div>
            <div className="w-32 h-2 bg-theme-border rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${calculateProjectProgress(project)}%` }}
                className="h-full bg-indigo-500 rounded-full"
              />
            </div>
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
          ? "bg-theme-card text-indigo-400 shadow-sm border border-theme-border" 
          : "text-slate-500 hover:bg-theme-card/50 hover:text-slate-400"
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
  globalConfig: GlobalConfig,
  onSelectSubtask: (taskId: string) => void
}) {
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

      {/* 6. Arquivos do Projeto */}
      <ProjectFilesSection 
        project={project} 
        onUpdateProject={(updates) => {
          setProjects({ ...project, ...updates } as Project);
        }} 
      />

      {/* 7. SUBTAREFAS (LIST FORMAT) */}
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
                const isEditing = editingSubtask === subtask.id;
                
                // Status is now calculated automatically
                const currentStatus = calculateSubtaskStatus(subtask);
                
                return (
                  <tr key={subtask.id} className={cn(
                    "group transition-all duration-300",
                    isEditing ? "bg-indigo-50/50" : "hover:bg-slate-50/50",
                    isReadOnly && !isEditing && "bg-slate-50/30"
                  )}>
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
                        <div>
                          <span className={cn(
                            "font-bold transition-colors",
                            isReadOnly ? "text-slate-400" : "text-slate-700"
                          )}>
                            {subtask.title}
                          </span>
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
                        currentStatus === 'Concluído' ? "bg-emerald-100 text-emerald-600" :
                        currentStatus === 'Em andamento' ? "bg-amber-100 text-amber-600" :
                        "bg-slate-200 text-slate-500"
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
                                  const updatedSubtasks = (project.subtasks || []).map(s => 
                                    s.id === subtask.id ? { 
                                      ...s, 
                                      title: tempSubtaskData.title,
                                      priority: tempSubtaskData.priority,
                                      responsibleId: tempSubtaskData.responsibleId
                                    } : s
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
                            
                            {/* Edição permitida apenas para pendentes */}
                            {currentStatus === 'Pendente' && (
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

function SettingsView({ users, globalConfig, projects, actions, mode, innovationConfig, onUpdateInnovationConfig, innovationProjects }: { 
  users: User[], 
  globalConfig: GlobalConfig, 
  projects: Project[],
  actions: OperationalAction[],
  mode: 'processos' | 'inovacao' | null,
  innovationConfig: InnovationConfig,
  onUpdateInnovationConfig: (config: InnovationConfig) => void,
  innovationProjects: InnovationProject[],
  key?: string 
}) {
  const [activeSubTab, setActiveSubTab] = useState<'cadastros' | 'setores-ferramentas' | 'relatorios' | 'tecnologias' | 'ganhos'>('cadastros');

  const menuItems = [
    { id: 'cadastros', label: 'Cadastros', icon: <Users size={18} /> },
    { 
      id: mode === 'inovacao' ? 'tecnologias' : 'setores-ferramentas', 
      label: mode === 'inovacao' ? 'Tecnologias e automações' : 'Setores e Ferramentas', 
      icon: <Settings size={18} /> 
    },
    { id: 'ganhos', label: 'Tipos de Ganhos', icon: <TrendingUp size={18} /> },
    { id: 'relatorios', label: 'Relatórios', icon: <FileText size={18} /> },
  ] as const;

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
            {activeSubTab === 'setores-ferramentas' && mode !== 'inovacao' && <GlobalConfigTab config={globalConfig} />}
            {activeSubTab === 'ganhos' && <GainTypesTab config={globalConfig} />}
            {activeSubTab === 'tecnologias' && mode === 'inovacao' && (
              <InnovationConfigTab 
                config={innovationConfig} 
                onUpdateConfig={onUpdateInnovationConfig} 
              />
            )}
            {activeSubTab === 'relatorios' && (
              mode === 'inovacao' 
                ? <InnovationReportsTab projects={innovationProjects} users={users} />
                : <ReportsTab projects={projects} users={users} actions={actions} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function InnovationConfigTab({ config, onUpdateConfig }: { 
  config: InnovationConfig, 
  onUpdateConfig: (config: InnovationConfig) => void 
}) {
  const [newTech, setNewTech] = useState('');
  const [editingTech, setEditingTech] = useState<{ index: number, value: string } | null>(null);

  const addTech = () => {
    if (!newTech.trim()) return;
    onUpdateConfig({
      ...config,
      technologies: [...(config.technologies || []), newTech.trim()]
    });
    setNewTech('');
  };

  const removeTech = (index: number) => {
    onUpdateConfig({
      ...config,
      technologies: config.technologies.filter((_, i) => i !== index)
    });
  };

  const updateTech = () => {
    if (!editingTech || !editingTech.value.trim()) return;
    const newTechnologies = [...config.technologies];
    newTechnologies[editingTech.index] = editingTech.value.trim();
    onUpdateConfig({ ...config, technologies: newTechnologies });
    setEditingTech(null);
  };

  return (
    <div className="p-8 space-y-10 w-full overflow-y-auto max-h-[80vh] custom-scrollbar">
      <div className="flex items-center gap-4 border-b border-slate-100 pb-8">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
          <Layers size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 leading-tight">Tecnologias e automações</h3>
          <p className="text-slate-500 text-sm mt-1">Gerencie as linguagens e tipos de automação do módulo de Inovação.</p>
        </div>
        <div className="ml-auto bg-indigo-50 text-indigo-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-100">
          {config.technologies?.length || 0} Itens
        </div>
      </div>

      <div className="max-w-2xl space-y-8">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Adicionar Nova Tecnologia</label>
          <div className="flex h-12 gap-2">
            <input 
              type="text" 
              value={newTech}
              onChange={(e) => setNewTech(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTech()}
              placeholder="Ex: Python, RPA, Chatbot, IA..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
            />
            <button 
              onClick={addTech}
              className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 shrink-0"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {config.technologies?.map((tech, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-indigo-200 hover:bg-white transition-all shadow-sm hover:shadow-md"
            >
              {editingTech?.index === index ? (
                <div className="flex-1 flex gap-2">
                  <input 
                    type="text" 
                    value={editingTech.value}
                    onChange={(e) => setEditingTech({ ...editingTech, value: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && updateTech()}
                    onBlur={updateTech}
                    autoFocus
                    className="flex-1 bg-white border border-indigo-500 rounded-lg px-2 py-1 text-sm font-medium outline-none"
                  />
                </div>
              ) : (
                <span className="text-sm font-bold text-slate-700">{tech}</span>
              )}
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setEditingTech({ index, value: tech })}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                >
                  <Edit size={14} />
                </button>
                <button 
                  onClick={() => removeTech(index)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          
          {(!config.technologies || config.technologies.length === 0) && (
            <div className="col-span-full py-12 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4 border border-slate-100 shadow-sm">
                <Layers size={20} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhuma tecnologia cadastrada</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex gap-4 items-start max-w-2xl">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 shadow-sm shrink-0 border border-amber-200">
          <AlertCircle size={20} />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-amber-900">Uso do Cadastro</h4>
          <p className="text-xs text-amber-700 leading-relaxed font-medium">
            Estas tecnologias serão exibidas como opções de múltipla escolha na aba **Escopo Técnico** de todos os projetos de Inovação. Alterações aqui são refletidas imediatamente.
          </p>
        </div>
      </div>
    </div>
  );
}

function GlobalConfigTab({ config }: { 
  config: GlobalConfig
}) {
  const [newSector, setNewSector] = useState('');
  const [newTool, setNewTool] = useState('');
  const [newTangibleType, setNewTangibleType] = useState('');
  const [newIntangibleType, setNewIntangibleType] = useState('');

  const updateConfig = async (updates: any) => {
    try {
      await setDoc(doc(db, 'config', 'global'), { ...config, ...updates }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'config/global');
    }
  };

  const ConfigSection = ({ title, description, items, newValue, setNewValue, field, placeholder }: {
    title: string,
    description: string,
    items: string[],
    newValue: string,
    setNewValue: (v: string) => void,
    field: string,
    placeholder: string
  }) => (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
        <p className="text-slate-500 text-sm mt-1">{description}</p>
      </div>
      <div className="flex gap-2">
        <input 
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button 
          onClick={() => {
            const trimmed = newValue.trim();
            if (trimmed && !items.includes(trimmed)) {
              updateConfig({ [field]: [...items, trimmed] });
              setNewValue('');
            }
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all"
        >
          Adicionar
        </button>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {items.map(item => (
          <div key={item} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group hover:border-indigo-200 transition-all">
            <span className="text-sm font-medium text-slate-700">{item}</span>
            <button 
              onClick={() => updateConfig({ [field]: items.filter(i => i !== item) })}
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
        />
        <ConfigSection 
          title="Ferramentas" 
          description="Gerencie as ferramentas disponíveis para seleção."
          items={config.tools || []}
          newValue={newTool}
          setNewValue={setNewTool}
          field="tools"
          placeholder="Nova ferramenta..."
        />
        <ConfigSection 
          title="Tipos de Ganho Tangível" 
          description="Opções para o cálculo de impacto financeiro/quantitativo."
          items={config.tangibleGainTypes || []}
          newValue={newTangibleType}
          setNewValue={setNewTangibleType}
          field="tangibleGainTypes"
          placeholder="Ex: Redução de Custo..."
        />
        <ConfigSection 
          title="Tipos de Ganho Intangível" 
          description="Opções para avaliação qualitativa."
          items={config.intangibleGainTypes || []}
          newValue={newIntangibleType}
          setNewValue={setNewIntangibleType}
          field="intangibleGainTypes"
          placeholder="Ex: Satisfação do Cliente..."
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
                          {item.units && item.units.length > 0 ? item.units.map(u => (
                            <span key={u} className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">{u}</span>
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
                      {(config.structuredUnits?.filter(u => u.active).map(u => u.symbol) || config.units || []).map(u => {
                        const isSelected = selectedUnits.includes(u);
                        return (
                          <label 
                            key={u} 
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
  const [profile, setProfile] = useState<UserProfile>('Usuário Analista');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fallback check for admin email just in case the profile isn't loaded yet in state
  const isMaster = currentUser?.profile === 'Usuário Master' || auth.currentUser?.email === 'bielalves201@gmail.com';

  useEffect(() => {
    if (editingUser) {
      setName(editingUser.name);
      setEmail(editingUser.email || '');
      setSector(editingUser.sector || '');
      setProfile(editingUser.profile || 'Usuário Analista');
    } else {
      setName('');
      setEmail('');
      setSector('');
      setProfile('Usuário Analista');
    }
  }, [editingUser]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !sector) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const userId = editingUser ? editingUser.id : uuidv4();
      const userData: User = {
        id: userId,
        name,
        email,
        sector,
        profile
      };

      await setDoc(doc(db, 'users', userId), userData, { merge: true });
      
      setName('');
      setEmail('');
      setSector('');
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

    if (user.profile === 'Usuário Master') {
      window.alert('Usuários Master não podem ser excluídos');
      return;
    }

    setUserToDelete(user);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    
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
              <label className="text-sm font-semibold text-slate-700 ml-1">Perfil</label>
              <select 
                value={profile}
                onChange={(e) => setProfile(e.target.value as UserProfile)}
                disabled={!isMaster}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="Usuário Analista">Usuário Analista</option>
                <option value="Usuário Master">Usuário Master</option>
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
                        (u.profile || 'Usuário Analista') === 'Usuário Master' ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-600"
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
      </AnimatePresence>
    </div>
  );
}

function PDCATab({ 
  project, 
  subtask, 
  onUpdateSubtask,
  selectedTaskId,
  onAddInnovationProject,
  onUpdateInnovationProject,
  innovationProjects = [],
  globalConfig
}: { 
  project: Project, 
  subtask: Subtask,
  onUpdateSubtask: (s: Subtask) => void,
  selectedTaskId?: string | null,
  onAddInnovationProject?: (data: any) => Promise<string>,
  onUpdateInnovationProject?: (id: string, updates: Partial<InnovationProject>) => Promise<void>,
  innovationProjects?: InnovationProject[],
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
          onAddInnovationProject={onAddInnovationProject}
          onUpdateInnovationProject={onUpdateInnovationProject}
          innovationProjects={innovationProjects}
          globalConfig={globalConfig}
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
