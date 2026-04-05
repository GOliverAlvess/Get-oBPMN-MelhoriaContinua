import React, { useState, useEffect, Component } from 'react';
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
  FileText,
  Settings,
  LogOut,
  ArrowRight,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { 
  auth, 
  db, 
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
import { Project, ProjectStatus, User } from './types';
import { cn } from './lib/utils';

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

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scope' | 'mapping' | 'pdca'>('scope');

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
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

    return () => {
      usersUnsubscribe();
      projectsUnsubscribe();
    };
  }, [user]);

  // Sync User Profile to Firestore
  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      setDoc(userDocRef, {
        id: user.uid,
        name: user.displayName || 'Usuário sem nome',
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
    // Update local state immediately for better UX
    setProjects(prev => prev.map(p => p.id === projectToSync.id ? projectToSync : p));
    setIsSaving(true);
    
    try {
      const projectRef = doc(db, 'projects', projectToSync.id);
      await setDoc(projectRef, projectToSync);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `projects/${projectToSync.id}`);
    } finally {
      setTimeout(() => setIsSaving(false), 1000);
    }
  };

  const handleCreateProject = async () => {
    if (!user) return;
    const newId = uuidv4();
    const newProject: Project = {
      id: newId,
      name: 'Novo Projeto',
      createdAt: new Date().toISOString(),
      progress: 0,
      status: 'Planejamento',
      assignedTo: user.uid,
      scope: {
        title: 'Novo Projeto',
        responsible: user.displayName || 'Admin',
        problemDescription: '',
        measurableObjective: '',
        involvedSectors: [],
        toolsUsed: [],
        startDate: new Date().toISOString(),
        forecastCompletion: new Date().toISOString(),
        financial: {
          currentImpact: { value: 0, type: 'continuo', period: 'mensal' },
          gainProjection: { value: 0, type: 'fixo', period: 'mensal' }
        }
      },
      mapping: { nodes: [], edges: [], orientation: 'horizontal', lastEdited: new Date().toISOString() },
      pdcaCycles: [],
      savedColors: []
    };

    try {
      await setDoc(doc(db, 'projects', newId), newProject);
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
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-100">
            <LayoutDashboard size={40} />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">ProcessFlow</h2>
            <p className="text-slate-500 text-sm">Gestão de Processos, BPMN e PDCA em um só lugar.</p>
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
        <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-50 hidden lg:flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <LayoutDashboard size={24} />
              </div>
              <h1 className="font-bold text-xl tracking-tight text-slate-800">ProcessFlow</h1>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <button 
              onClick={handleBackToKanban}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                !selectedProjectId ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <LayoutDashboard size={20} />
              <span>Projetos (Kanban)</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 transition-all duration-200">
              <Users size={20} />
              <span>Equipe</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 transition-all duration-200">
              <Settings size={20} />
              <span>Configurações</span>
            </button>
          </nav>

          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="User" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{user.displayName}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
              <LogOut 
                size={18} 
                className="text-slate-400 hover:text-red-500 cursor-pointer" 
                onClick={handleLogout}
              />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className={cn(
          "transition-all duration-300 min-h-screen",
          "lg:ml-64 p-4 lg:p-8"
        )}>
          <AnimatePresence mode="wait">
            {!selectedProjectId ? (
              <KanbanView 
                key="kanban"
                projects={projects} 
                users={users} 
                onProjectClick={handleProjectClick} 
                onCreateProject={handleCreateProject}
              />
            ) : (
              <ProjectDetailView 
                key="detail"
                project={selectedProject!} 
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onBack={handleBackToKanban}
                setProjects={syncProjectToFirestore as any}
                isSaving={isSaving}
              />
            )}
          </AnimatePresence>
        </main>
      </div>
    </ErrorBoundary>
  );
}

// --- KANBAN VIEW ---

function KanbanView({ projects, users, onProjectClick, onCreateProject }: { 
  projects: Project[], 
  users: User[], 
  onProjectClick: (id: string) => void,
  onCreateProject: () => void,
  key?: string
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Gestão de Projetos</h2>
          <p className="text-slate-500 mt-1">Visualize e gerencie o fluxo de melhoria contínua.</p>
        </div>
        <button 
          onClick={onCreateProject}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus size={20} />
          <span>Novo Projeto</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map(user => (
          <div key={user.id} className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
                <h3 className="font-bold text-slate-700">{user.name}</h3>
                <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">
                  {projects.filter(p => p.assignedTo === user.id).length}
                </span>
              </div>
              <button className="text-slate-400 hover:text-slate-600">
                <MoreVertical size={18} />
              </button>
            </div>

            <div className="bg-slate-100/50 p-3 rounded-2xl min-h-[500px] space-y-4 border border-slate-200/50">
              {projects.filter(p => p.assignedTo === user.id).map(project => (
                <ProjectCard 
                  key={project.id} 
                  project={project} 
                  onClick={() => onProjectClick(project.id)} 
                />
              ))}
              
              <button 
                onClick={onCreateProject}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 hover:border-indigo-300 hover:text-indigo-400 transition-all flex items-center justify-center gap-2 group"
              >
                <Plus size={18} className="group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">Adicionar Projeto</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function ProjectCard({ project, onClick }: { project: Project, onClick: () => void, key?: string }) {
  const statusColors = {
    'Planejamento': 'bg-amber-100 text-amber-700 border-amber-200',
    'Em Execução': 'bg-blue-100 text-blue-700 border-blue-200',
    'Suspenso': 'bg-rose-100 text-rose-700 border-rose-200',
    'Concluído': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <motion.div 
      whileHover={{ y: -4, shadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
      onClick={onClick}
      className="bg-white p-5 rounded-xl border border-slate-200 cursor-pointer transition-all"
    >
      <div className="flex justify-between items-start mb-4">
        <span className={cn(
          "text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md border",
          statusColors[project.status]
        )}>
          {project.status}
        </span>
        <button className="text-slate-300 hover:text-slate-500">
          <MoreVertical size={16} />
        </button>
      </div>

      <h4 className="font-bold text-slate-800 leading-tight mb-4 group-hover:text-indigo-600 transition-colors">
        {project.name}
      </h4>

      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} />
            <span>{format(new Date(project.createdAt), 'dd MMM yyyy', { locale: ptBR })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            <span>{project.progress}%</span>
          </div>
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

function ProjectDetailView({ project, activeTab, setActiveTab, onBack, setProjects, isSaving }: { 
  project: Project, 
  activeTab: string, 
  setActiveTab: (tab: any) => void,
  onBack: () => void,
  setProjects: (p: Project) => void,
  isSaving: boolean,
  key?: string
}) {
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
              <h2 className="text-2xl font-bold text-slate-900">{project.name}</h2>
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
                Iniciado em {format(new Date(project.scope.startDate), 'dd/MM/yyyy')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setProjects(project)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
          >
            <Save size={18} />
            Salvar Alterações
          </button>
          
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <TabButton 
              active={activeTab === 'scope'} 
              onClick={() => setActiveTab('scope')} 
              icon={<FileText size={18} />} 
              label="Escopo" 
            />
            <TabButton 
              active={activeTab === 'mapping'} 
              onClick={() => setActiveTab('mapping')} 
              icon={<GitBranch size={18} />} 
              label="Mapeamento" 
            />
            <TabButton 
              active={activeTab === 'pdca'} 
              onClick={() => setActiveTab('pdca')} 
              icon={<RefreshCw size={18} />} 
              label="PDCA" 
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[600px] overflow-hidden">
        {activeTab === 'scope' && <ScopeTab project={project} setProjects={setProjects} />}
        {activeTab === 'mapping' && <MappingTab project={project} setProjects={setProjects} />}
        {activeTab === 'pdca' && <PDCATab project={project} setProjects={setProjects} />}
      </div>
    </motion.div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all font-medium text-sm",
        active 
          ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// --- SCOPE TAB ---

function ScopeTab({ project, setProjects }: { project: Project, setProjects: (p: Project) => void }) {
  const updateScope = (field: string, value: any) => {
    setProjects({ ...project, scope: { ...project.scope, [field]: value } });
  };

  const updateFinancial = (section: 'currentImpact' | 'gainProjection', field: string, value: any) => {
    setProjects({ 
      ...project, 
      scope: { 
        ...project.scope, 
        financial: { 
          ...project.scope.financial, 
          [section]: { ...project.scope.financial[section], [field]: value } 
        } 
      } 
    });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-8">
          <section>
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="text-indigo-500" size={20} />
              Informações Gerais
            </h3>
            <div className="space-y-4">
              <FormField 
                label="Título do Projeto" 
                value={project.scope.title} 
                onChange={(v) => updateScope('title', v)}
              />
              <FormField 
                label="Responsável" 
                value={project.scope.responsible} 
                readOnly 
              />
              <FormField 
                label="Descrição do Problema" 
                value={project.scope.problemDescription} 
                type="textarea" 
                onChange={(v) => updateScope('problemDescription', v)}
              />
              <FormField 
                label="Objetivo Mensurável" 
                value={project.scope.measurableObjective} 
                onChange={(v) => updateScope('measurableObjective', v)}
              />
            </div>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar className="text-indigo-500" size={20} />
              Cronograma
            </h3>
            <div className="grid grid-cols-2 gap-4">
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
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Target className="text-indigo-500" size={20} />
              Impacto Financeiro
            </h3>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Impacto Atual</p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold">R$</span>
                    <input 
                      type="number"
                      value={project.scope.financial.currentImpact.value}
                      onChange={(e) => updateFinancial('currentImpact', 'value', parseFloat(e.target.value) || 0)}
                      className="text-3xl font-black text-slate-900 bg-transparent border-b border-slate-200 outline-none w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select 
                      value={project.scope.financial.currentImpact.period}
                      onChange={(e) => updateFinancial('currentImpact', 'period', e.target.value)}
                      className="text-xs bg-white border border-slate-200 p-1 rounded font-bold uppercase"
                    >
                      <option value="mensal">Mensal</option>
                      <option value="anual">Anual</option>
                    </select>
                    <select 
                      value={project.scope.financial.currentImpact.type}
                      onChange={(e) => updateFinancial('currentImpact', 'type', e.target.value)}
                      className="text-xs bg-white border border-slate-200 p-1 rounded font-bold uppercase"
                    >
                      <option value="fixo">Fixo</option>
                      <option value="continuo">Contínuo</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="h-px bg-slate-200" />
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Projeção de Ganho</p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">R$</span>
                    <input 
                      type="number"
                      value={project.scope.financial.gainProjection.value}
                      onChange={(e) => updateFinancial('gainProjection', 'value', parseFloat(e.target.value) || 0)}
                      className="text-3xl font-black text-emerald-600 bg-transparent border-b border-emerald-100 outline-none w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select 
                      value={project.scope.financial.gainProjection.period}
                      onChange={(e) => updateFinancial('gainProjection', 'period', e.target.value)}
                      className="text-xs bg-white border border-slate-200 p-1 rounded font-bold uppercase"
                    >
                      <option value="mensal">Mensal</option>
                      <option value="anual">Anual</option>
                    </select>
                    <select 
                      value={project.scope.financial.gainProjection.type}
                      onChange={(e) => updateFinancial('gainProjection', 'type', e.target.value)}
                      className="text-xs bg-white border border-slate-200 p-1 rounded font-bold uppercase"
                    >
                      <option value="fixo">Fixo</option>
                      <option value="continuo">Contínuo</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Users className="text-indigo-500" size={20} />
              Setores e Ferramentas
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Setores Envolvidos</label>
                <div className="flex flex-wrap gap-2">
                  {project.scope.involvedSectors.map(s => (
                    <span key={s.id} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium border border-indigo-100 flex items-center gap-2">
                      {s.name}
                      <button 
                        onClick={() => updateScope('involvedSectors', project.scope.involvedSectors.filter(item => item.id !== s.id))}
                        className="hover:text-rose-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button 
                    onClick={() => {
                      const name = prompt('Nome do setor:');
                      if (name) updateScope('involvedSectors', [...project.scope.involvedSectors, { id: uuidv4(), name }]);
                    }}
                    className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-sm font-bold border border-slate-200 border-dashed hover:border-indigo-300 hover:text-indigo-500"
                  >
                    + Adicionar
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Ferramentas Utilizadas</label>
                <div className="flex flex-wrap gap-2">
                  {project.scope.toolsUsed.map(t => (
                    <span key={t.id} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm font-medium border border-slate-200 flex items-center gap-2">
                      {t.name}
                      <button 
                        onClick={() => updateScope('toolsUsed', project.scope.toolsUsed.filter(item => item.id !== t.id))}
                        className="hover:text-rose-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button 
                    onClick={() => {
                      const name = prompt('Nome da ferramenta:');
                      if (name) updateScope('toolsUsed', [...project.scope.toolsUsed, { id: uuidv4(), name }]);
                    }}
                    className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-sm font-bold border border-slate-200 border-dashed hover:border-indigo-300 hover:text-indigo-500"
                  >
                    + Adicionar
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value, type = 'text', readOnly = false, onChange }: { label: string, value: any, type?: string, readOnly?: boolean, onChange?: (v: any) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</label>
      {readOnly ? (
        <div className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 cursor-not-allowed">
          {value}
        </div>
      ) : type === 'textarea' ? (
        <textarea 
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-700 min-h-[100px] outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
      ) : (
        <input 
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
      )}
    </div>
  );
}

import MappingTab from './components/MappingTab';
import PDCAEditor from './components/PDCAEditor';

// --- PDCA TAB ---

function PDCATab({ project, setProjects }: { project: Project, setProjects: (p: Project) => void }) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  if (isEditorOpen) {
    return (
      <div className="fixed inset-0 z-[100] bg-white">
        <PDCAEditor 
          project={project} 
          setProjects={setProjects} 
          onBack={() => setIsEditorOpen(false)} 
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
        {project.pdcaCycles.length === 0 ? (
          <div className="py-20 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400">
            <RefreshCw size={48} className="mb-4 opacity-20" />
            <p className="font-medium">Nenhum ciclo PDCA iniciado para este projeto.</p>
            <p className="text-sm">Identifique problemas no mapeamento para iniciar um ciclo.</p>
          </div>
        ) : (
          project.pdcaCycles.map(cycle => (
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
