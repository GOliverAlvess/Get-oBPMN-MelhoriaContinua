import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  ExternalLink, 
  Download, 
  Trash2, 
  Loader2, 
  Paperclip,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { Project, ProjectFile } from '../types';
import { db, collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, handleFirestoreError, OperationType, auth } from '../firebase';
import { cn } from '../lib/utils';
import { logUserActivity } from '../lib/activityLogger';
import { getApiUrl } from '../utils/apiUrl';

// Propriedades recebidas pelo componente de lista de anexos do projeto (ProjectFilesSection)
interface ProjectFilesSectionProps {
  project: Project; // Modelo do projeto cujos anexos estão sendo gerenciados
  onUpdateProject: (updates: Partial<Project>) => void; // Função de retorno disparada ao atualizar metadados primários do projeto
}

// Componente reativo encarregado por listar e carregar documentos e imagens salvos no Google Drive associados ao projeto
export default function ProjectFilesSection({ project, onUpdateProject }: ProjectFilesSectionProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]); // Lista contendo os metadados dos arquivos anexos
  const [isUploading, setIsUploading] = useState(false); // Estado gerenciador do progresso de upload
  const [uploadProgress, setUploadProgress] = useState<string | null>(null); // Texto com o progresso do upload
  const [isDragging, setIsDragging] = useState(false); // Estado ativado durante a ação de arrastar arquivos
  const [loadingFiles, setLoadingFiles] = useState(true); // Controla a exibição de spin/loader antes dos arquivos serem baixados do Firestore
  const [uploadError, setUploadError] = useState<string | null>(null); // Armazena mensagens decorrentes de erros de envio

  // Carrega e atualiza em tempo real a listagem de arquivos anexados ao projeto consultando a coleção projectFiles do Firestore
  useEffect(() => {
    if (!project.id) return;

    setLoadingFiles(true);
    // Cria uma query estruturada para obter apenas documentos associados ao ID deste projeto
    const q = query(
      collection(db, 'projectFiles'),
      where('projectId', '==', project.id)
    );

    // Escuta alterações na subcoleção do Firestore atualizando dinamicamente a interface do sistema
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const filesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ProjectFile[];
        
        // Ordena do arquivo mais recente para o mais antigo com base na propriedade uploadedAt
        setFiles(filesList.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
        setLoadingFiles(false);
      },
      (error) => {
        console.error("Erro ao resgatar arquivos do Firestore:", error);
        setLoadingFiles(false);
      }
    );

    return () => unsubscribe(); // Limpa as inscrições do Snapshot ao desmontar o componente
  }, [project.id]);

  // Função unificada de processamento de múltiplos arquivos (via input ou Drag and Drop)
  const processFiles = async (filesToUpload: FileList | File[]) => {
    const fileArray = Array.from(filesToUpload);
    if (fileArray.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const selectedFile = fileArray[i];
      setUploadProgress(
        fileArray.length > 1 
          ? `Enviando (${i + 1}/${fileArray.length}): ${selectedFile.name}` 
          : `Enviando ${selectedFile.name}...`
      );

      // Cria formulário em Multipart Data para envio do anexo
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('projectId', project.id);
      formData.append('projectName', project.name);
      if (project.driveFolderId) {
        formData.append('driveFolderId', project.driveFolderId);
      }

      try {
        const headers: Record<string, string> = {};
        if (auth.currentUser?.email) {
          headers['x-user-email'] = auth.currentUser.email;
        }
        if (auth.currentUser?.uid) {
          headers['x-user-uid'] = auth.currentUser.uid;
        }

        const response = await fetch(getApiUrl('/api/drive/upload'), {
          method: 'POST',
          headers,
          body: formData,
        });

        if (!response.ok) {
          let errorMsg = `Falha ao processar o upload do arquivo ${selectedFile.name} (HTTP ${response.status})`;
          try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
              errorMsg = errorData.error;
            }
          } catch (e) {
            if (response.status === 413) {
              errorMsg = `O arquivo ${selectedFile.name} excede o limite máximo permitido para upload (100 MB).`;
            }
          }
          throw new Error(errorMsg);
        }

        const data = await response.json();

        // Caso uma nova pasta raiz tenha sido instanciada no Google Drive, vincula a propriedade driveFolderId ao modelo do projeto
        if (data.driveFolderId && data.driveFolderId !== project.driveFolderId) {
          const projectRef = doc(db, 'projects', project.id);
          await updateDoc(projectRef, {
            driveFolderId: data.driveFolderId
          });
          onUpdateProject({ driveFolderId: data.driveFolderId });
        }

        // Prepara os metadados catalogáveis do anexo para gravação no banco de dados
        const fileMetadata = {
          projectId: project.id,
          fileName: data.fileName || selectedFile.name,
          fileId: data.fileId,
          fileUrl: data.fileUrl,
          uploadedAt: new Date().toISOString(),
          size: data.size || selectedFile.size,
          mimeType: data.mimeType || selectedFile.type
        };

        // Grava histórico de anexo na tabela projectFiles
        await addDoc(collection(db, 'projectFiles'), fileMetadata);
        
        logUserActivity({
          userId: auth.currentUser?.uid || '',
          userName: auth.currentUser?.displayName || 'Usuário',
          userEmail: auth.currentUser?.email || '',
          actionType: 'file_upload',
          actionName: 'Upload de Anexo',
          details: `Enviou o anexo '${fileMetadata.fileName}' para o card`,
          entityId: fileMetadata.fileId,
          entityName: fileMetadata.fileName
        });

        successCount++;
      } catch (error: any) {
        console.error(`Falha ao salvar anexo ${selectedFile.name} no Drive:`, error);
        errors.push(`${selectedFile.name}: ${error.message || 'Erro de upload'}`);
      }
    }

    if (errors.length > 0) {
      setUploadError(errors.join(' | '));
    }

    setIsUploading(false);
    setUploadProgress(null);
  };

  // Trata a seleção de arquivos via seletor nativo do sistema
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    e.target.value = '';
  };

  // Handlers para suporte completo a Drag & Drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Verifica se o cursor realmente saiu do elemento contêiner
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir este arquivo?')) return;
    try {
      await deleteDoc(doc(db, 'projectFiles', fileId));
    } catch (error) {
      console.error("Erro ao deletar arquivo:", error);
      alert("Falha ao deletar arquivo.");
    }
  };

  // Formata o tamanho em bytes do documento para uma string amigável ao usuário (KB, MB, GB, etc)
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "bg-white border rounded-3xl overflow-hidden shadow-sm transition-all relative",
        isDragging 
          ? "border-2 border-dashed border-indigo-500 bg-indigo-50/40 ring-4 ring-indigo-100 shadow-xl" 
          : "border-slate-100"
      )}
    >
      {/* Overlay responsivo acionado visualmente ao arrastar arquivos */}
      {isDragging && (
        <div className="absolute inset-0 z-30 bg-indigo-600/10 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 p-6 text-indigo-700 pointer-events-none animate-fade-in">
          <div className="p-4 bg-white rounded-3xl shadow-xl border border-indigo-200 text-indigo-600 scale-110 animate-bounce">
            <Upload size={32} />
          </div>
          <div className="text-center">
            <h4 className="text-base font-black uppercase tracking-tight text-indigo-900">Solte os arquivos para enviar</h4>
            <p className="text-xs font-bold text-indigo-600 mt-1">
              Suporta múltiplos arquivos simultaneamente (salvos no Google Drive)
            </p>
          </div>
        </div>
      )}

      {/* Cabeçalho da Seção contendo botão de envio */}
      <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
            <Paperclip size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Arquivos do Projeto</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
              Arraste e solte ou selecione múltiplos arquivos (Google Drive)
            </p>
          </div>
        </div>

        {/* Componente Label atuando como elemento clicável atrelado ao input oculto de file upload */}
        <label className={cn(
          "flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-tight cursor-pointer hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 shrink-0",
          isUploading && "opacity-60 cursor-not-allowed"
        )}>
          {isUploading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span className="truncate max-w-[180px]">{uploadProgress || "Enviando..."}</span>
            </>
          ) : (
            <>
              <Upload size={14} />
              Enviar Arquivos
            </>
          )}
          <input 
            type="file" 
            multiple
            className="hidden" 
            onChange={handleFileUpload}
            disabled={isUploading}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.svg,.txt,.csv,.zip,.rar,.7z,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/*"
          />
        </label>
      </div>

      <div className="p-6">
        {/* Painel de erros de upload caso ocorram durante o envio multipart */}
        {uploadError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600">
            <AlertCircle size={18} className="shrink-0" />
            <p className="text-xs font-bold leading-tight">{uploadError}</p>
          </div>
        )}

        {/* Indicator de upload em andamento */}
        {isUploading && (
          <div className="mb-6 p-4 bg-indigo-50/80 border border-indigo-100 rounded-2xl flex items-center gap-3 text-indigo-700 animate-pulse">
            <Loader2 size={18} className="animate-spin text-indigo-600 shrink-0" />
            <p className="text-xs font-bold leading-tight">{uploadProgress || "Processando arquivos..."}</p>
          </div>
        )}

        {/* Switch renderizador de status: carregando, lista populada ou painel em branco */}
        {loadingFiles ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
            <span className="text-xs font-bold uppercase tracking-widest">Carregando arquivos...</span>
          </div>
        ) : files.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file) => (
              <div 
                key={file.id} 
                className="group p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-200 hover:bg-white transition-all shadow-sm hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-500 group-hover:text-indigo-600 group-hover:border-indigo-50 group-hover:bg-indigo-50/50 transition-all">
                    <FileText size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-slate-700 truncate line-clamp-1" title={file.fileName}>
                      {file.fileName}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">
                      {format(new Date(file.uploadedAt), 'dd/MM/yyyy HH:mm')}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>

                {/* Ações disponíveis para os arquivos */}
                <div className="flex items-center gap-2 mt-4">
                  <a 
                    href={file.fileUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    <ExternalLink size={12} />
                    Visualizar
                  </a>
                  <a 
                    href={file.fileUrl.replace('/view', '/download')} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                    title="Baixar"
                  >
                    <Download size={14} />
                  </a>
                  <button 
                    onClick={() => handleFileDelete(file.id)}
                    className="p-1.5 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 hover:text-rose-600 transition-all ml-1"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50/50 hover:bg-indigo-50/20 hover:border-indigo-300 transition-all cursor-pointer relative group">
            <label className="absolute inset-0 cursor-pointer flex flex-col items-center justify-center p-6">
              <input 
                type="file" 
                multiple
                className="hidden" 
                onChange={handleFileUpload}
                disabled={isUploading}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.svg,.txt,.csv,.zip,.rar,.7z,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/*"
              />
              <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:scale-110 mx-auto mb-4 shadow-sm border border-slate-100 transition-all">
                <Upload size={28} />
              </div>
              <h4 className="text-sm font-black text-slate-700 uppercase tracking-tight">Arraste seus arquivos aqui</h4>
              <p className="text-xs text-slate-400 font-medium mt-2 max-w-xs mx-auto">
                Ou clique para selecionar múltiplos arquivos (fotos, documentos, planilhas). Tudo será salvo no Google Drive.
              </p>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
