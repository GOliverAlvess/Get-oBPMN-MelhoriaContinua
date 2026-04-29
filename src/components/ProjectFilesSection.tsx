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
import { db, collection, query, where, onSnapshot, addDoc, doc, updateDoc, handleFirestoreError, OperationType } from '../firebase';
import { cn } from '../lib/utils';

interface ProjectFilesSectionProps {
  project: Project;
  onUpdateProject: (updates: Partial<Project>) => void;
}

export default function ProjectFilesSection({ project, onUpdateProject }: ProjectFilesSectionProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Load files from Firestore
  useEffect(() => {
    if (!project.id) return;

    setLoadingFiles(true);
    const q = query(
      collection(db, 'projectFiles'),
      where('projectId', '==', project.id)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const filesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ProjectFile[];
        
        setFiles(filesList.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
        setLoadingFiles(false);
      },
      (error) => {
        console.error("Error fetching files:", error);
        setLoadingFiles(false);
      }
    );

    return () => unsubscribe();
  }, [project.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('projectId', project.id);
    formData.append('projectName', project.name);
    if (project.driveFolderId) {
      formData.append('driveFolderId', project.driveFolderId);
    }

    try {
      const response = await fetch('/api/drive/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload file');
      }

      const data = await response.json();

      // If a new folder was created, update project
      if (data.driveFolderId && data.driveFolderId !== project.driveFolderId) {
        const projectRef = doc(db, 'projects', project.id);
        await updateDoc(projectRef, {
          driveFolderId: data.driveFolderId
        });
        onUpdateProject({ driveFolderId: data.driveFolderId });
      }

      // Save file metadata to Firestore
      const fileMetadata = {
        projectId: project.id,
        fileName: data.fileName,
        fileId: data.fileId,
        fileUrl: data.fileUrl,
        uploadedAt: new Date().toISOString(),
        size: data.size,
        mimeType: data.mimeType
      };

      await addDoc(collection(db, 'projectFiles'), fileMetadata);
      
      // Reset input
      e.target.value = '';
    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadError(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
            <Paperclip size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Arquivos do Projeto</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Gestão via Google Drive</p>
          </div>
        </div>

        <label className={cn(
          "flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-tight cursor-pointer hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100",
          isUploading && "opacity-50 cursor-not-allowed"
        )}>
          {isUploading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload size={14} />
              Enviar Arquivo
            </>
          )}
          <input 
            type="file" 
            className="hidden" 
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </label>
      </div>

      <div className="p-6">
        {uploadError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600">
            <AlertCircle size={18} className="shrink-0" />
            <p className="text-xs font-bold leading-tight">{uploadError}</p>
          </div>
        )}

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
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/30">
            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-slate-300 mx-auto mb-4 shadow-sm border border-slate-100">
              <Paperclip size={32} />
            </div>
            <h4 className="text-sm font-black text-slate-600 uppercase tracking-tight">Nenhum arquivo enviado</h4>
            <p className="text-xs text-slate-400 font-medium mt-2 max-w-xs mx-auto">
              Comece a anexar documentos, fotos ou planilhas ao seu projeto. Todos os arquivos serão salvos no Google Drive.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
