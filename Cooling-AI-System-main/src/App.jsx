import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Activity, 
  Wind, 
  Droplets, 
  Settings, 
  TrendingUp, 
  Thermometer, 
  Zap, 
  Factory, 
  Cpu,
  RefreshCw,
  BarChart3,
  LayoutDashboard,
  MessageSquare,
  Send,
  Bot,
  User,
  Sparkles,
  AlertTriangle,
  Table as TableIcon,
  Loader2,
  Save,
  Bell,
  List,
  ChevronRight,
  PieChart as PieChartIcon
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine
} from 'recharts';

// --- 配置与常量 ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const TEXT_MODEL = "gemini-2.5-flash-preview-09-2025";

// --- 实用工具函数 ---

// 移除 Markdown 符号以便在图表等纯文本环境显示
const stripMarkdown = (text) => {
  if (typeof text !== 'string') return text;
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`/g, '');
};

// --- 模拟数据生成 ---
const generateTimeData = (points = 24) => {
  const data = [];
  const now = new Date();
  for (let i = 0; i < points; i++) {
    const time = new Date(now.getTime() - (points - i) * 3600000);
    const hour = time.getHours();
    data.push({
      time: `${hour}:00`,
      power: 400 + Math.random() * 200 + (hour > 8 && hour < 18 ? 300 : 0),
      demand: 1200 + Math.random() * 400,
      optimizedPower: 350 + Math.random() * 150 + (hour > 8 && hour < 18 ? 200 : 0),
      efficiency: 3.5 + Math.random() * 1.5
    });
  }
  return data;
};

const ENERGY_DISTRIBUTION = [
  { name: '压缩机组', value: 65, color: '#3b82f6' },
  { name: '冷却泵', value: 15, color: '#6366f1' },
  { name: '冷却塔风机', value: 12, color: '#10b981' },
  { name: '照明与辅助', value: 8, color: '#f59e0b' },
];

const INITIAL_REALTIME_DATA = {
  compressor: { status: 'Running', power: 245.5, cop: 4.2, inTemp: 12.1, outTemp: 7.2 },
  coolingTower: { status: 'Running', fanSpeed: 85, inTemp: 32.5, outTemp: 28.1, humidity: 65 },
  pump: { status: 'Running', frequency: 45.2, flow: 120, pressure: 0.35 },
  userSide: { load: 1450, setPoint: 7.0, returnTemp: 12.5, deltaT: 5.5 },
  environment: { temp: 31.2, humidity: 55, wetBulb: 24.5 }
};

// --- 通用 AI 调用函数 ---
const callGemini = async (prompt, systemInstruction) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] }
  };

  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i <= delays.length; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (error) {
      if (i === delays.length) throw new Error("AI服务不可用，请稍后再试。");
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }
};

// --- 精细化渲染组件 ---

// 1. 数学公式渲染器 (支持 LaTeX)
const LatexRenderer = ({ children }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (window.katex && containerRef.current) {
      try {
        window.katex.render(children, containerRef.current, {
          throwOnError: false,
          displayMode: false
        });
      } catch (e) {
        console.error("KaTeX error:", e);
      }
    }
  }, [children]);

  return <span ref={containerRef}>{children}</span>;
};

// 2. 通用混合文本渲染组件 (支持 LaTeX + Markdown 加粗)
const FormattedText = ({ content }) => {
  if (!content) return null;
  // 同时支持 $...$ 数学公式和 **...** 加粗
  const regex = /(\$.*?\$|\*\*.*?\*\*)/g;
  const parts = content.split(regex);

  return parts.map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      return <LatexRenderer key={i}>{part.slice(1, -1)}</LatexRenderer>;
    } else if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-blue-400 font-bold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

// 3. 增强型 Markdown 解析
const MarkdownRenderer = ({ text }) => {
  const blocks = useMemo(() => {
    const res = [];
    const lines = text.split('\n');
    let currentBlock = [];
    let isTable = false;

    lines.forEach((line) => {
      const isTableLine = line.trim().startsWith('|');
      if (isTableLine && !isTable) {
        if (currentBlock.length > 0) res.push({ type: 'text', content: currentBlock.join('\n') });
        currentBlock = [line];
        isTable = true;
      } else if (!isTableLine && isTable) {
        if (currentBlock.length > 0) res.push({ type: 'table', content: currentBlock.join('\n') });
        currentBlock = [line];
        isTable = false;
      } else {
        currentBlock.push(line);
      }
    });
    if (currentBlock.length > 0) res.push({ type: isTable ? 'table' : 'text', content: currentBlock.join('\n') });
    return res;
  }, [text]);

  return (
    <div className="space-y-2">
      {blocks.map((block, idx) => {
        if (block.type === 'table') return <MarkdownTable key={idx} content={block.content} />;
        return (
          <div key={idx} className="space-y-1">
            {block.content.split('\n').map((line, i) => {
              if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-blue-400 mt-4 mb-2 flex items-center gap-2"><ChevronRight size={14} /> <FormattedText content={line.replace('### ', '')} /></h3>;
              if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-white mt-5 mb-3 border-b border-slate-700 pb-1"><FormattedText content={line.replace('## ', '')} /></h2>;
              if (line.trim().startsWith('- ')) return <div key={i} className="flex gap-2 ml-2 my-0.5 text-slate-300"><span className="text-blue-500 mt-1.5 shrink-0 w-1 h-1 rounded-full bg-blue-500"></span><span><FormattedText content={line.trim().substring(2)} /></span></div>;
              return <p key={i} className="min-h-[1rem]"><FormattedText content={line} /></p>;
            })}
          </div>
        );
      })}
    </div>
  );
};

const MarkdownTable = ({ content }) => {
  const rows = content.trim().split('\n').filter(r => r.includes('|') && !r.match(/^\|?\s*[:\-|\s]+\s*\|?$/));
  if (rows.length < 1) return null;
  const parseRow = (r) => r.split('|').map(c => c.trim()).filter((c, i, a) => !((i === 0 || i === a.length-1) && c === ''));
  const header = parseRow(rows[0]);
  const body = rows.slice(1).map(parseRow);

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/20 shadow-inner">
      <table className="w-full text-[11px] text-left border-collapse">
        <thead className="bg-slate-800/50 text-slate-400">
          <tr>{header.map((h, i) => <th key={i} className="px-4 py-2 font-bold uppercase tracking-widest"><FormattedText content={h} /></th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {body.map((row, i) => (
            <tr key={i} className="hover:bg-blue-500/5 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 text-slate-300">
                  <FormattedText content={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// 4. 自定义 Tooltip (自动清洗标签)
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md">
        <p className="text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-tighter">{label} 运行记录</p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                <span className="text-xs text-slate-300">{stripMarkdown(entry.name)}</span>
              </span>
              <span className="text-xs font-mono font-bold text-white">
                {entry.value.toFixed(1)} <span className="text-[10px] text-slate-500">{entry.unit || ''}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const MiniChart = ({ data, type = "power" }) => (
  <div className="h-40 w-full mt-4 bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50 group">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`grad-${type}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/>
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey={type} stroke="#3b82f6" strokeWidth={2} fill={`url(#grad-${type})`} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

// --- 主应用组件 ---

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [realtimeData, setRealtimeData] = useState(INITIAL_REALTIME_DATA);
  const [historyData, setHistoryData] = useState(generateTimeData(24));
  
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      text: '你好！我是您的智控助手。检测到系统出口温度略有波动。\n\n## 当前运行概览\n系统出口温度设定值为 $7.0^\\circ\\text{C}$，实际温度为 $7.2^\\circ\\text{C}$。\n\n| 关键指标 | 读数 | 状态 |\n|---|---|---|\n| 出口温度 | $7.2^\\circ\\text{C}$ | 🟡 观察 |\n| 环境湿球温度 | $24.5^\\circ\\text{C}$ | 🟢 优 |\n\n### AI 洞察\n- 建议提高 **被冷却介质出口温度** 的监控频率，确保波动范围在 $\\pm 0.1^\\circ\\text{C}$ 以内。',
      chartData: historyData.slice(0, 15),
      chartType: "power"
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // 挂载 KaTeX 和 Tailwind
  useEffect(() => {
    // Tailwind
    const tw = document.createElement('script');
    tw.src = "https://cdn.tailwindcss.com";
    document.head.appendChild(tw);

    // KaTeX CSS
    const ktCss = document.createElement('link');
    ktCss.rel = "stylesheet";
    ktCss.href = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css";
    document.head.appendChild(ktCss);

    // KaTeX JS
    const ktJs = document.createElement('script');
    ktJs.src = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js";
    document.head.appendChild(ktJs);

    const style = document.createElement('style');
    style.innerHTML = `
      body, html, #root { margin: 0; padding: 0; height: 100%; width: 100%; background-color: #060a11; color: #e2e8f0; overflow: hidden; }
      .custom-scrollbar::-webkit-scrollbar { width: 5px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
      .katex { font-size: 1.1em; color: #3b82f6; }
    `;
    document.head.appendChild(style);
  }, []);

  // 优化自动滚动逻辑：确保定位到消息框的最底部
  useEffect(() => {
    if (activeTab === 'assistant') {
      // 使用 block: 'end' 确保底部对齐，避免页面整体上移
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, isTyping, activeTab]);

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;
    const userText = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setIsTyping(true);

    const systemPrompt = `你是一个专业的工业制冷系统AI管家。
    当前参数：主机功率 ${realtimeData.compressor.power}kW, COP ${realtimeData.compressor.cop}。
    请使用 Markdown 格式回答：
    1. 数学单位、科学计数法、温度符号必须包裹在 $ 符号中，例如 $7.0^\\circ\\text{C}$。
    2. 如果提到具体的设备名称（如 **被冷却介质出口温度**），请根据上下文判断是否需要加粗。
    3. 严禁在图表或表格的 Key 中使用 Markdown 格式，确保数据标签纯净。`;

    try {
      const response = await callGemini(userText, systemPrompt);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: response, 
        chartData: historyData.slice(0, 15),
        chartType: 'power'
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: `通讯异常: ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex w-full h-full bg-[#060a11] text-slate-200 overflow-hidden font-sans">
      {/* 侧边导航 */}
      <aside className="w-20 flex-shrink-0 flex flex-col items-center py-8 bg-slate-950 border-r border-slate-800/50 z-50">
        <div className="mb-12 text-blue-500"><Factory size={32} /></div>
        <nav className="flex flex-col gap-8">
          {[
            { id: 'dashboard', icon: LayoutDashboard },
            { id: 'forecast', icon: TrendingUp },
            { id: 'assistant', icon: MessageSquare },
            { id: 'control', icon: Settings }
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`p-3.5 rounded-2xl transition-all duration-500 ${activeTab === item.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-300'}`}
            >
              <item.icon size={22} />
            </button>
          ))}
        </nav>
      </aside>

      {/* 主体区域 */}
      <div className="flex-grow flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-20 flex-shrink-0 border-b border-slate-800 bg-slate-950/20 backdrop-blur-2xl flex items-center px-8 md:px-12 justify-between z-40">
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
              CHILLER-INTEL <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">Node_Active</span>
            </h1>
          </div>
          <div className="text-right">
             <div className="text-[10px] text-slate-500 uppercase font-bold">系统能效 COP</div>
             <div className="text-2xl font-mono font-black text-blue-400 leading-none">{realtimeData.compressor.cop}</div>
          </div>
        </header>

        <main className="flex-grow overflow-y-auto px-6 md:px-12 py-8 custom-scrollbar">
          <div className="max-w-screen-2xl mx-auto space-y-10 pb-20">
            
            {activeTab === 'dashboard' && (
              <div className="animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                  {[
                    { label: '压缩机功率', value: realtimeData.compressor.power, unit: 'kW', icon: Cpu, color: '#3b82f6' },
                    { label: '能效比 COP', value: realtimeData.compressor.cop, unit: '', icon: Zap, color: '#10b981' },
                    { label: '末端总负载', value: realtimeData.userSide.load, unit: 'kW', icon: Activity, color: '#f59e0b' },
                    { label: '室外气温', value: realtimeData.environment.temp, unit: '°C', icon: Thermometer, color: '#6366f1' }
                  ].map((stat, i) => (
                    <div key={i} className="p-6 bg-slate-900/30 border border-slate-800/60 rounded-3xl">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</div>
                      <div className="text-3xl font-mono font-black" style={{ color: stat.color }}>{stat.value} <span className="text-xs font-sans text-slate-600">{stat.unit}</span></div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900/20 border border-slate-800 rounded-[2.5rem] p-8">
                  <h3 className="text-xl font-bold text-white mb-10 flex items-center gap-3"><BarChart3 size={24} className="text-blue-500" /> 实时负荷趋势</h3>
                  <div className="h-[450px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historyData}>
                        <defs>
                          <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="time" stroke="#475569" fontSize={11} />
                        <YAxis stroke="#475569" fontSize={11} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" name="实时能耗" dataKey="power" stroke="#3b82f6" strokeWidth={4} fill="url(#mainGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'assistant' && (
              <div className="h-[calc(100vh-16rem)] flex flex-col max-w-5xl mx-auto animate-in slide-in-from-right-8 duration-500">
                <div className="flex-1 bg-slate-900/20 border border-slate-800 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl">
                  <div className="p-6 border-b border-slate-800 bg-slate-950/40 backdrop-blur-xl flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center"><Bot size={28} className="text-white" /></div>
                    <div>
                      <h3 className="font-black text-white text-lg tracking-tight uppercase">Seeing Assistant</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Latex & MD Enabled</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
                    {messages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                        <div className={`flex gap-4 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-700' : 'bg-blue-600/20 text-blue-400 border border-blue-500/20'}`}>
                            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                          </div>
                          <div className={`p-6 rounded-3xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800/60 text-slate-200 rounded-tl-none border border-slate-800'}`}>
                            <MarkdownRenderer text={msg.text} />
                            {msg.chartData && <MiniChart data={msg.chartData} type={msg.chartType} />}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isTyping && <div className="flex justify-start gap-4 items-center"><Loader2 size={16} className="animate-spin text-blue-500" /><span className="text-xs text-slate-500 font-bold uppercase tracking-widest animate-pulse">深度分析中...</span></div>}
                    {/* 滚动锚点 */}
                    <div ref={chatEndRef} className="h-4" />
                  </div>

                  <div className="p-6 bg-slate-950/40 border-t border-slate-800">
                    <div className="relative max-w-4xl mx-auto">
                      <input 
                        type="text" 
                        value={input} 
                        onChange={(e) => setInput(e.target.value)} 
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} 
                        placeholder="输入关于出口温度、COP或负荷预测的问题..." 
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-5 pl-8 pr-24 focus:outline-none focus:border-blue-500/50 text-sm" 
                      />
                      <button 
                        onClick={handleSendMessage} 
                        disabled={isTyping}
                        className="absolute right-3 top-3 bottom-3 px-8 bg-blue-600 hover:bg-blue-500 rounded-xl text-white flex items-center gap-2 disabled:opacity-50"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'forecast' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in slide-in-from-bottom-8 duration-500">
                 <div className="bg-slate-900/20 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
                   <h3 className="text-lg font-bold mb-10 text-amber-400 flex items-center gap-3 uppercase tracking-wider"><TrendingUp size={24} /> 24h 负荷预测</h3>
                   <div className="h-[450px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="time" stroke="#475569" fontSize={11} />
                          <YAxis stroke="#475569" fontSize={11} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="demand" stroke="#f59e0b" strokeWidth={4} fill="#f59e0b" fillOpacity={0.1} />
                        </AreaChart>
                      </ResponsiveContainer>
                   </div>
                 </div>
                 <div className="bg-slate-900/20 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
                   <h3 className="text-lg font-bold mb-10 text-teal-400 flex items-center gap-3 uppercase tracking-wider"><Zap size={24} /> 优化增效空间</h3>
                   <div className="h-[450px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={historyData.slice(0, 12)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="time" stroke="#475569" fontSize={11} />
                          <YAxis stroke="#475569" fontSize={11} />
                          <Tooltip cursor={{fill: '#1e293b', opacity: 0.4}} content={<CustomTooltip />} />
                          <Bar dataKey="power" fill="#3b82f6" radius={[6, 6, 0, 0]} name="原始能耗" />
                          <Bar dataKey="optimizedPower" fill="#10b981" radius={[6, 6, 0, 0]} name="优化能耗" />
                        </BarChart>
                      </ResponsiveContainer>
                   </div>
                 </div>
              </div>
            )}
            
            {activeTab === 'control' && (
              <div className="max-w-4xl mx-auto p-10 bg-slate-900/20 border border-slate-800 rounded-[3rem]">
                <h2 className="text-2xl font-black text-white flex items-center gap-3 mb-10"><Settings className="text-blue-500" /> 系统全局策略</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">目标出水温度 (°C)</label>
                    <input type="number" defaultValue="7.0" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-blue-400 font-mono font-bold" />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">COP 告警阈值</label>
                    <input type="number" defaultValue="3.5" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-amber-400 font-mono font-bold" />
                  </div>
                </div>
                <button className="mt-12 w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2">
                  <Save size={18} /> 保存并同步配置
                </button>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* 底部装饰 */}
      <footer className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        <div className="bg-slate-900/90 border border-slate-700/50 px-10 py-4 rounded-full backdrop-blur-3xl flex items-center gap-8 shadow-2xl border-t-2 border-t-blue-500/20">
          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e] animate-pulse"></span> SYSTEM_HEALTH_OK
          </div>
          <div className="w-[1px] h-4 bg-slate-800"></div>
          <div className="text-[11px] text-blue-400 font-black uppercase tracking-[0.2em] animate-pulse">Latex & Scroll Fix Applied</div>
        </div>
      </footer>
    </div>
  );
};

export default App;
