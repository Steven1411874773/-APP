import React, { useState, useRef, useEffect } from 'react';
import { extractFramesFromVideo, formatTime } from './services/videoUtils';
import { analyzeVideoFrames } from './services/geminiService';
import { Project, ProjectStatus, AnalysisResult, TimelineItem } from './types';
import { 
  PlusIcon, 
  VideoCameraIcon, 
  MapPinIcon, 
  ClockIcon, 
  SparklesIcon,
  XMarkIcon,
  PhotoIcon,
  ArrowTopRightOnSquareIcon,
  PencilIcon,
  ArrowDownTrayIcon,
  MapIcon,
  MagnifyingGlassIcon,
  ClipboardIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

// --- Main App Component ---

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload -> create new project
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files: File[] = Array.from(e.target.files);
      const newProjects: Project[] = files.map(file => ({
        id: crypto.randomUUID(),
        file,
        status: 'idle' as ProjectStatus,
        frames: [],
        result: null,
        createdAt: Date.now()
      }));
      
      setProjects(prev => [...prev, ...newProjects]);
      
      // Auto-start processing for new projects
      newProjects.forEach(p => processProject(p.id, p.file));
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processProject = async (projectId: string, file: File) => {
    try {
      updateProjectStatus(projectId, 'extracting');
      
      // 1. Extract Frames (High density)
      const frames = await extractFramesFromVideo(file, 120); 
      updateProject(projectId, { frames, status: 'analyzing' });
      
      // 2. Analyze with Gemini
      const result = await analyzeVideoFrames(frames);
      updateProject(projectId, { result, status: 'done' });

    } catch (err: any) {
      console.error(err);
      updateProject(projectId, { status: 'error', error: err.message || "处理失败" });
    }
  };

  const updateProjectStatus = (id: string, status: ProjectStatus) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setProjects(prev => prev.filter(p => p.id !== id));
    if (selectedProjectId === id) setSelectedProjectId(null);
  };

  const handleRenameProject = (id: string, newName: string) => {
     updateProject(id, { customName: newName });
  };

  // Used by DetailOverlay to update local project state when editing content
  const handleUpdateResult = (id: string, newResult: AnalysisResult) => {
      updateProject(id, { result: newResult });
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 h-16 glass border-b border-gray-200/50 flex items-center justify-between px-6 sm:px-10 transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center text-white shadow-lg shadow-black/10">
            <SparklesIcon className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">VlogFlow <span className="text-gray-400 font-normal">工作台</span></h1>
        </div>
        <div>
            {/* Right side actions if needed */}
        </div>
      </nav>

      {/* Main Workspace (Whiteboard) */}
      <main className="flex-1 p-8 sm:p-12 overflow-y-auto">
        <div className="max-w-[1800px] mx-auto">
          
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">我的项目</h2>
              <p className="text-gray-500 mt-1">智能拆解，生成您的专属旅游路书</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
            
            {/* Add New Button Card */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="group relative h-80 rounded-[32px] border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/30 transition-all duration-300 flex flex-col items-center justify-center gap-4 bg-gray-50/50"
            >
              <div className="w-16 h-16 rounded-full bg-white shadow-sm group-hover:shadow-md flex items-center justify-center transition-all group-hover:scale-110">
                <PlusIcon className="w-8 h-8 text-gray-400 group-hover:text-blue-500" />
              </div>
              <span className="font-medium text-gray-500 group-hover:text-blue-600">导入新视频</span>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="video/*" 
                multiple
                className="hidden" 
              />
            </button>

            {/* Project Cards */}
            {projects.map(project => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                onClick={() => project.status === 'done' && setSelectedProjectId(project.id)}
                onDelete={(e) => deleteProject(e, project.id)}
                onRename={(newName) => handleRenameProject(project.id, newName)}
              />
            ))}

          </div>
        </div>
      </main>

      {/* Detailed Overlay Modal */}
      {selectedProject && selectedProject.result && (
        <DetailOverlay 
          project={selectedProject} 
          onClose={() => setSelectedProjectId(null)} 
          onUpdate={(newResult) => handleUpdateResult(selectedProject.id, newResult)}
        />
      )}
    </div>
  );
}

// --- Project Card Component ---

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onRename: (name: string) => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick, onDelete, onRename }) => {
  const thumbnail = project.frames.length > 0 ? `data:image/jpeg;base64,${project.frames[0].base64}` : null;
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(project.customName || project.file.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingName]);

  const handleNameSubmit = () => {
      setIsEditingName(false);
      if (nameInput.trim()) onRename(nameInput);
  };

  const displayName = project.customName || project.file.name;

  return (
    <div 
      onClick={onClick}
      className={`relative h-80 rounded-[32px] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-500 group overflow-hidden border border-white cursor-pointer ${project.status === 'done' ? 'hover:-translate-y-1' : ''}`}
    >
      {/* Delete Button */}
      <button 
        onClick={onDelete}
        className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/20 backdrop-blur hover:bg-red-500 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 scale-90 hover:scale-100"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>

      {/* Rename Button (Visible on Hover) */}
      <button
        onClick={(e) => { e.stopPropagation(); setIsEditingName(true); }}
        className="absolute top-4 left-4 z-20 w-8 h-8 rounded-full bg-black/20 backdrop-blur hover:bg-white/30 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 scale-90 hover:scale-100"
      >
        <PencilIcon className="w-4 h-4" />
      </button>

      {/* Image / State Layer */}
      <div className="absolute inset-0 bg-gray-100">
        {thumbnail ? (
          <img src={thumbnail} className="w-full h-full object-cover opacity-95 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" alt="Thumbnail" />
        ) : (
           <div className="w-full h-full flex items-center justify-center text-gray-300">
             <VideoCameraIcon className="w-12 h-12" />
           </div>
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </div>

      {/* Status Indicators */}
      <div className="absolute bottom-0 left-0 right-0 p-6 text-white z-10">
        {project.status === 'done' && project.result ? (
          <div>
            <div className="flex gap-2 mb-2">
               {project.result.vibe.slice(0, 2).map((tag, i) => (
                   <span key={i} className="text-[10px] font-bold tracking-wide px-2 py-0.5 bg-white/20 backdrop-blur-md rounded-md border border-white/10 text-white/90">
                       {tag}
                   </span>
               ))}
            </div>
            {isEditingName ? (
                <input 
                    ref={inputRef}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onBlur={handleNameSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border-b border-white/50 text-white font-bold text-lg w-full focus:outline-none mb-1"
                />
            ) : (
                <h3 className="text-lg font-bold leading-snug line-clamp-2 mb-1">{project.result.title}</h3>
            )}
            <p className="text-xs text-gray-300 line-clamp-1">{displayName}</p>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-bold mb-2 truncate">{project.file.name}</h3>
            {project.status === 'error' ? (
               <span className="inline-flex items-center text-red-300 text-sm"><XMarkIcon className="w-4 h-4 mr-1"/> {project.error}</span>
            ) : (
               <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span className="text-sm font-medium text-gray-200">
                    {project.status === 'extracting' ? '正在提取帧...' : 'AI 智能分析中...'}
                  </span>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Detail Overlay Component ---

interface DetailOverlayProps {
    project: Project;
    onClose: () => void;
    onUpdate: (result: AnalysisResult) => void;
}

const DetailOverlay: React.FC<DetailOverlayProps> = ({ project, onClose, onUpdate }) => {
  const result = project.result!;
  const [activeFrame, setActiveFrame] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedResult, setEditedResult] = useState<AnalysisResult>(result);

  useEffect(() => {
      setEditedResult(result);
  }, [result]);
  
  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSave = () => {
      onUpdate(editedResult);
      setIsEditing(false);
  };

  const handleExportMarkdown = () => {
      const md = `
# ${result.title}
> ${result.summary}

**Tags**: ${result.vibe.join(', ')}

---

${result.timeline.map(item => `
### ${item.timestamp} - ${item.location || '未知地点'}
*${item.content}*

${item.foodItems && item.foodItems.length ? `**美食**: ${item.foodItems.join(', ')}` : ''}

`).join('\n---\n')}
      `;
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.customName || 'travel-guide'}.md`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleOpenRoute = () => {
      // Filter locations that look like real places
      const locations = result.timeline
        .map(t => t.location)
        .filter(l => l && l.length > 1 && !l.includes("未知") && !l.includes("Unknown"));
      
      const uniqueLocations = Array.from(new Set(locations));
      if (uniqueLocations.length === 0) {
          alert("未找到有效地点");
          return;
      }

      // Construct Google Maps Directions URL
      // https://www.google.com/maps/dir/Place1/Place2/Place3
      const dirPath = uniqueLocations.map(l => encodeURIComponent(l)).join('/');
      const url = `https://www.google.com/maps/dir/${dirPath}`;
      window.open(url, '_blank');
  };

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
  };

  // Collect all unique shops/spots
  const allShops = Array.from(new Set(
      editedResult.timeline
        .filter(t => t.location && t.location !== '未知地点')
        .map(t => t.location)
  ));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-[90vw] h-full max-h-[92vh] bg-[#FFFFFF] rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
        
        {/* Header Bar */}
        <div className="h-20 flex items-center justify-between px-8 border-b border-gray-100 shrink-0 bg-white/90 backdrop-blur z-20 sticky top-0">
          <div className="flex flex-col">
             {isEditing ? (
                 <input 
                    className="text-xl font-bold text-gray-900 border-b border-gray-300 focus:border-blue-500 focus:outline-none"
                    value={editedResult.title}
                    onChange={(e) => setEditedResult({...editedResult, title: e.target.value})}
                 />
             ) : (
                <h2 className="text-xl font-bold text-gray-900 truncate max-w-md">{editedResult.title}</h2>
             )}
            <div className="flex gap-2 text-xs text-gray-500 mt-1">
                <span>{project.customName || project.file.name}</span>
                <span>•</span>
                <span>{editedResult.timeline.length} 个精彩瞬间</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {isEditing ? (
                 <button onClick={handleSave} className="px-5 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center gap-2">
                    <CheckIcon className="w-4 h-4" /> 保存修改
                 </button>
             ) : (
                 <button onClick={() => setIsEditing(true)} className="px-5 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2">
                    <PencilIcon className="w-4 h-4" /> 编辑内容
                 </button>
             )}
             
             <div className="h-6 w-px bg-gray-200 mx-1"></div>

             <button onClick={handleExportMarkdown} className="p-2.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors" title="导出 Markdown">
                <ArrowDownTrayIcon className="w-5 h-5" />
             </button>
             <button onClick={onClose} className="p-2.5 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
                <XMarkIcon className="w-6 h-6" />
             </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-white">
            
            {/* Left Sidebar: Detailed Info & Tools */}
            <div className="md:w-80 lg:w-[400px] shrink-0 bg-gray-50 border-r border-gray-200/60 overflow-y-auto p-8 custom-scrollbar">
                
                {/* Summary Section */}
                <div className="mb-10">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <ClipboardIcon className="w-4 h-4" /> 视频摘要
                    </h3>
                    {isEditing ? (
                        <textarea 
                            className="w-full h-32 p-3 rounded-xl border border-gray-300 text-sm leading-relaxed focus:border-blue-500 focus:outline-none"
                            value={editedResult.summary}
                            onChange={(e) => setEditedResult({...editedResult, summary: e.target.value})}
                        />
                    ) : (
                        <p className="text-gray-700 leading-relaxed text-base font-medium bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            {editedResult.summary}
                        </p>
                    )}
                </div>

                {/* Detected Shops List */}
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-3">
                         <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <MapPinIcon className="w-4 h-4" /> 发现店铺 / 地点
                        </h3>
                        {allShops.length > 0 && (
                             <button onClick={handleOpenRoute} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-md flex items-center gap-1 transition-colors">
                                <MapIcon className="w-3 h-3" /> 规划路线
                             </button>
                        )}
                    </div>
                   
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        {allShops.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-400">未检测到明确地点</div>
                        ) : (
                            <ul className="divide-y divide-gray-50">
                                {allShops.map((shop, i) => (
                                    <li key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 group transition-colors">
                                        <span className="text-sm font-medium text-gray-800 truncate select-all">{shop}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleCopy(shop)} className="p-1.5 hover:bg-gray-200 rounded text-gray-500" title="复制">
                                                <ClipboardIcon className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(shop)}`, '_blank')} 
                                                className="p-1.5 hover:bg-blue-100 text-blue-500 rounded" 
                                                title="搜索"
                                            >
                                                <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
                
                {/* Stats */}
                 <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">数据统计</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <StatCard label="发现美食" value={editedResult.timeline.reduce((acc, i) => acc + (i.foodItems?.length || 0), 0)} icon="🍔" />
                        <StatCard label="打卡地点" value={allShops.length} icon="📍" />
                    </div>
                </div>

            </div>

            {/* Right Content: Timeline Feed */}
            <div className="flex-1 p-8 sm:p-12 overflow-y-auto bg-white custom-scrollbar">
                 <div className="max-w-4xl mx-auto pb-20">
                    <h3 className="text-2xl font-bold mb-10 text-gray-900 flex items-center gap-2">
                        <VideoCameraIcon className="w-7 h-7 text-blue-600" />
                        图文拆解流
                    </h3>
                    
                    <div className="space-y-16 relative before:absolute before:left-8 md:before:left-1/2 before:top-4 before:bottom-0 before:w-px before:bg-gradient-to-b before:from-gray-200 before:via-gray-200 before:to-transparent">
                        {editedResult.timeline.map((item, index) => {
                            const frame = project.frames[item.bestFrameIndex];
                            const isRight = index % 2 === 0;
                            
                            return (
                                <TimelineItemView 
                                    key={index} 
                                    item={item} 
                                    frame={frame} 
                                    isRight={isRight} 
                                    isEditing={isEditing}
                                    onUpdate={(newItem) => {
                                        const newTimeline = [...editedResult.timeline];
                                        newTimeline[index] = newItem;
                                        setEditedResult({...editedResult, timeline: newTimeline});
                                    }}
                                />
                            );
                        })}
                    </div>
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};

// Subcomponent for Timeline Item
const TimelineItemView = ({ 
    item, 
    frame, 
    isRight, 
    isEditing, 
    onUpdate 
}: { 
    item: TimelineItem, 
    frame: any, 
    isRight: boolean, 
    isEditing: boolean, 
    onUpdate: (item: TimelineItem) => void 
}) => {
    return (
        <div className={`relative flex flex-col md:flex-row gap-8 md:gap-16 items-start ${isRight ? '' : 'md:flex-row-reverse'}`}>
            
            {/* Timestamp Marker */}
            <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-4 border-blue-500 z-10 shadow-sm mt-6"></div>
            
            {/* Image Side */}
            <div className="w-full md:w-1/2 pl-16 md:pl-0">
                <div className="relative group rounded-2xl overflow-hidden shadow-lg border border-gray-100 transition-all hover:shadow-xl bg-gray-100 aspect-video">
                    {frame && (
                        <img 
                            src={`data:image/jpeg;base64,${frame.base64}`} 
                            alt={item.content}
                            className="w-full h-full object-cover"
                        />
                    )}
                    <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded backdrop-blur-md">
                        {formatTime(item.timeOffset)}
                    </div>
                </div>
            </div>

            {/* Text Side */}
            <div className="w-full md:w-1/2 pl-16 md:pl-0 text-left">
                    <div className={`flex flex-col ${isRight ? 'md:items-start' : 'md:items-end md:text-right'} w-full`}>
                    
                    <span className={`inline-block mb-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                        ${item.highlightType === 'food' ? 'bg-orange-100 text-orange-700' : 
                            item.highlightType === 'scenery' ? 'bg-green-100 text-green-700' : 
                            'bg-blue-100 text-blue-700'}`}>
                        {item.highlightType === 'food' ? '美食探店' : item.highlightType === 'scenery' ? '风景打卡' : '旅途片段'}
                    </span>
                    
                    {isEditing ? (
                        <div className={`w-full space-y-2 ${isRight ? 'text-left' : 'text-right'}`}>
                            <input 
                                className={`w-full text-xl font-bold text-gray-900 border-b border-gray-200 focus:border-blue-500 outline-none pb-1 ${isRight ? 'text-left' : 'text-right'}`}
                                value={item.location}
                                onChange={(e) => onUpdate({...item, location: e.target.value})}
                                placeholder="地点名称"
                            />
                            <textarea 
                                className={`w-full p-2 border border-gray-200 rounded text-sm ${isRight ? 'text-left' : 'text-right'}`}
                                value={item.content}
                                onChange={(e) => onUpdate({...item, content: e.target.value})}
                                rows={3}
                            />
                            <input 
                                className={`w-full text-sm text-orange-600 border-b border-orange-100 focus:border-orange-500 outline-none ${isRight ? 'text-left' : 'text-right'}`}
                                value={item.foodItems?.join(', ')}
                                onChange={(e) => onUpdate({...item, foodItems: e.target.value.split(',').map(s => s.trim())})}
                                placeholder="美食列表 (逗号分隔)"
                            />
                        </div>
                    ) : (
                        <>
                            <h4 className="text-xl font-bold text-gray-900 mb-2 leading-tight select-all">
                                {item.location || "旅途一角"}
                            </h4>
                            
                            <p className="text-gray-600 leading-relaxed mb-4 text-base select-text">
                                {item.content}
                            </p>

                            {item.foodItems && item.foodItems.length > 0 && (
                                <div className={`flex flex-wrap gap-2 ${isRight ? 'justify-start' : 'justify-end'}`}>
                                    {item.foodItems.map((food, fi) => (
                                        <span key={fi} className="inline-flex items-center text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100 select-all">
                                            <SparklesIcon className="w-3 h-3 mr-1" />
                                            {food}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    </div>
            </div>
        </div>
    );
};

const StatCard = ({label, value, icon}: {label: string, value: number, icon: string}) => (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
        <span className="text-2xl mb-1">{icon}</span>
        <span className="font-bold text-gray-900 text-lg">{value}</span>
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
    </div>
);
