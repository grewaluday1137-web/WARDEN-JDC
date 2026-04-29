import { motion, useMotionValue, useSpring, useTransform, useScroll } from 'framer-motion';
import { ArrowRight, Shield, Activity, Zap, Server, ShieldAlert, Crosshair, Radar } from 'lucide-react';
import React, { useRef, useEffect } from 'react';

// --- Ultra Bold 3D Tilt Card ---
const TiltCard = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Extremely responsive springs for aggressive snapping
  const mouseXSpring = useSpring(x, { stiffness: 400, damping: 25 });
  const mouseYSpring = useSpring(y, { stiffness: 400, damping: 25 });

  // Bold rotation angles (up to 30 degrees!)
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["30deg", "-30deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-30deg", "30deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateY,
        rotateX,
        transformStyle: "preserve-3d",
      }}
      className={`relative rounded-3xl ${className}`}
    >
      <div 
        style={{ transform: "translateZ(80px)" }} 
        className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-3xl pointer-events-none mix-blend-overlay" 
      />
      {children}
    </motion.div>
  );
};

// --- Mouse Tracking 3D Hero Graphic ---
const InteractiveHeroGraphic = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 100, damping: 30 });
  const springY = useSpring(mouseY, { stiffness: 100, damping: 30 });

  const rotateX = useTransform(springY, [-0.5, 0.5], ["30deg", "-30deg"]);
  const rotateY = useTransform(springX, [-0.5, 0.5], ["-45deg", "45deg"]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const xPct = e.clientX / window.innerWidth - 0.5;
      const yPct = e.clientY / window.innerHeight - 0.5;
      mouseX.set(xPct);
      mouseY.set(yPct);
    };
    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto aspect-square perspective-[2000px] flex items-center justify-center">
      <motion.div 
        style={{ 
          rotateX, 
          rotateY, 
          transformStyle: "preserve-3d" 
        }}
        className="w-full h-full relative flex items-center justify-center"
      >
        {/* Core Shield */}
        <motion.div 
          animate={{ scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute w-48 h-48 bg-slate-900/90 backdrop-blur-3xl border-2 border-sky-400 rounded-[2rem] flex items-center justify-center overflow-hidden"
          style={{ transform: "translateZ(150px)", boxShadow: "0 0 100px rgba(14,165,233,0.4), inset 0 0 40px rgba(14,165,233,0.4)" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.3)_0%,transparent_70%)]" />
          <ShieldAlert className="w-24 h-24 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] z-10" />
        </motion.div>

        {/* Dynamic Rings */}
        <motion.div 
          animate={{ rotateZ: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute w-[80%] h-[80%] rounded-full border border-sky-500/50"
          style={{ transform: "translateZ(-50px) rotateX(70deg)" }}
        >
          <div className="absolute top-0 left-1/2 w-4 h-4 bg-sky-400 rounded-full blur-[2px] shadow-[0_0_20px_#38bdf8]" />
        </motion.div>

        <motion.div 
          animate={{ rotateZ: -360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute w-[100%] h-[100%] rounded-full border-[3px] border-red-500/30 border-dashed"
          style={{ transform: "translateZ(50px) rotateX(45deg) rotateY(30deg)" }}
        >
           <Radar className="absolute bottom-1/4 right-0 w-8 h-8 text-red-500 animate-pulse" />
        </motion.div>

        {/* Orbiting UI Elements */}
        <motion.div 
          className="absolute glass-panel p-3 rounded-xl border border-emerald-500/50 flex items-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
          style={{ transform: "translateZ(250px) translateX(-150px) translateY(-100px)" }}
        >
          <Crosshair className="w-5 h-5 text-emerald-400 animate-spin-slow" />
          <span className="text-emerald-400 font-mono text-sm font-bold">TARGET LOCKED</span>
        </motion.div>
        
        <motion.div 
          className="absolute glass-panel p-3 rounded-xl border border-red-500/50 flex flex-col gap-1 shadow-[0_0_30px_rgba(239,68,68,0.2)]"
          style={{ transform: "translateZ(200px) translateX(180px) translateY(120px)" }}
        >
          <span className="text-red-400 font-mono text-xs uppercase">Threat Level</span>
          <span className="text-red-500 font-bold text-xl leading-none">CRITICAL</span>
        </motion.div>

      </motion.div>
    </div>
  );
};

// --- Mini Animated Visualizers ---
const TelemetryVis = () => (
  <div className="relative w-full h-full rounded-full border border-sky-500/30 overflow-hidden flex items-center justify-center bg-slate-900/50">
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      className="absolute w-[50%] h-[50%] origin-bottom-right right-1/2 bottom-1/2 bg-gradient-to-tr from-sky-400/40 to-transparent"
      style={{ clipPath: "polygon(100% 100%, 0 0, 100% 0)" }}
    />
    <Activity className="w-6 h-6 text-sky-400 relative z-10" />
  </div>
);

const ThreatVis = () => (
  <div className="relative w-full h-full flex items-center justify-center">
    {[1, 2, 3].map((i) => (
      <motion.div
        key={i}
        animate={{ scale: [0.3, 1.5], opacity: [0.8, 0] }}
        transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
        className="absolute w-[80%] h-[80%] rounded-full border border-emerald-500"
      />
    ))}
    <Shield className="w-6 h-6 text-emerald-400 relative z-10" />
  </div>
);

const DeploymentVis = () => (
  <div className="relative w-full h-full flex items-center justify-center">
    <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100">
      <motion.line x1="25" y1="25" x2="75" y2="75" stroke="#fbbf24" strokeWidth="2" animate={{ strokeDasharray: ["0, 100", "100, 0"] }} transition={{ duration: 2, repeat: Infinity }} />
      <motion.line x1="25" y1="75" x2="75" y2="25" stroke="#fbbf24" strokeWidth="2" animate={{ strokeDasharray: ["0, 100", "100, 0"] }} transition={{ duration: 2, repeat: Infinity, delay: 1 }} />
    </svg>
    <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1, repeat: Infinity }} className="absolute top-1/4 left-1/4 w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_10px_#fbbf24]" />
    <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }} className="absolute bottom-1/4 right-1/4 w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_10px_#fbbf24]" />
    <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }} className="absolute top-1/4 right-1/4 w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_10px_#fbbf24]" />
    <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1.1, repeat: Infinity, delay: 0.9 }} className="absolute bottom-1/4 left-1/4 w-2 h-2 bg-amber-400 rounded-full shadow-[0_0_10px_#fbbf24]" />
    <Zap className="w-6 h-6 text-amber-400 relative z-10 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]" />
  </div>
);

const CommVis = () => {
  const [text, setText] = React.useState("ENCRYPT");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*";
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      let scrambled = "";
      for (let i = 0; i < 7; i++) {
        scrambled += chars[Math.floor(Math.random() * chars.length)];
      }
      setText(scrambled);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-900 rounded-xl overflow-hidden border border-purple-500/20">
      <Server className="w-5 h-5 text-purple-400 mb-1 opacity-50" />
      <span className="font-mono text-[10px] text-purple-400 tracking-widest">{text}</span>
      <motion.div 
        animate={{ y: ["-100%", "200%"] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/20 to-transparent w-full h-1/2"
      />
    </div>
  );
};

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

  const features = [
    {
      icon: <TelemetryVis />,
      title: 'Real-time Telemetry',
      description: 'Stream live data from IoT sensors, drones, and mobile units directly to the command center.',
      glow: 'group-hover:shadow-[0_0_40px_rgba(56,189,248,0.4)]'
    },
    {
      icon: <ThreatVis />,
      title: 'AI Threat Detection',
      description: 'Advanced machine learning algorithms identify critical anomalies before they escalate.',
      glow: 'group-hover:shadow-[0_0_40px_rgba(52,211,153,0.4)]'
    },
    {
      icon: <DeploymentVis />,
      title: 'Rapid Deployment',
      description: 'Deploy response units with optimized routing and resource allocation within seconds.',
      glow: 'group-hover:shadow-[0_0_40px_rgba(251,191,36,0.4)]'
    },
    {
      icon: <CommVis />,
      title: 'Decentralized Comm',
      description: 'Maintain communication lines even when traditional infrastructure fails during a crisis.',
      glow: 'group-hover:shadow-[0_0_40px_rgba(192,132,252,0.4)]'
    },
  ];

  return (
    <div className="flex flex-col items-center w-full relative">
      
      {/* Immersive 3D Grid Background */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-[#020617] perspective-[1000px]">
        <motion.div 
          style={{ y: backgroundY }}
          className="absolute inset-[-50%] w-[200%] h-[200%] origin-top"
        >
          {/* Floor Grid */}
          <div 
            className="absolute bottom-0 left-0 w-full h-[70%] border-t border-sky-900/50 bg-[linear-gradient(to_right,#0ea5e920_1px,transparent_1px),linear-gradient(to_bottom,#0ea5e920_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:linear-gradient(to_top,#000_10%,transparent_100%)]"
            style={{ transform: "rotateX(75deg) translateZ(-200px)" }}
          />
        </motion.div>
        {/* Ambient Spots */}
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-sky-600/10 rounded-full blur-[150px] mix-blend-screen" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[150px] mix-blend-screen" />
      </div>

      {/* Hero Section */}
      <section className="w-full relative flex flex-col items-center justify-center min-h-[95vh] px-4 overflow-hidden pt-24 pb-12">
        <div className="max-w-[90rem] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center z-10 w-full">
          
          {/* Text Content */}
          <motion.div 
            initial={{ opacity: 0, x: -100, rotateY: 20 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            transition={{ duration: 1, type: "spring", bounce: 0.4 }}
            className="text-left perspective-1000"
          >
            <motion.div 
              initial={{ opacity: 0, z: -50 }}
              animate={{ opacity: 1, z: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-sky-500/40 text-sm font-bold text-sky-400 mb-10 shadow-[0_0_20px_rgba(14,165,233,0.2)]"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500 shadow-[0_0_10px_#38bdf8]"></span>
              </span>
              <span className="glitch-text" data-text="WARDEN OS v3.0 INITIALIZED">WARDEN OS v3.0 INITIALIZED</span>
            </motion.div>
            
            <h1 className="text-6xl sm:text-7xl lg:text-[5.5rem] font-black tracking-tighter mb-8 leading-[1.05] text-white" style={{ transformStyle: "preserve-3d" }}>
              <motion.span 
                initial={{ opacity: 0, rotateX: 90 }}
                animate={{ opacity: 1, rotateX: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="block origin-bottom chromatic-aberration"
              >
                MASTER THE
              </motion.span>
              <motion.span 
                initial={{ opacity: 0, rotateX: -90 }}
                animate={{ opacity: 1, rotateX: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="block origin-top text-gradient-alert drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] chromatic-aberration"
                style={{ transform: "translateZ(50px)" }}
              >
                UNEXPECTED.
              </motion.span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-slate-300 mb-12 max-w-2xl leading-relaxed font-medium">
              Next-generation spatial intelligence and crisis routing. Neutralize threats in 3D space with absolute precision.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <a href="https://warden-simulation-774533752332.us-central1.run.app" className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 text-white font-black text-lg transition-all shadow-[0_20px_40px_-10px_rgba(239,68,68,0.5)] hover:shadow-[0_30px_60px_-15px_rgba(239,68,68,0.7)] hover:-translate-y-2 active:translate-y-1 flex items-center justify-center gap-3 border-b-4 border-red-800">
                LIVE SIMULATION <ArrowRight className="w-6 h-6" />
              </a>
              <button className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-slate-800/50 backdrop-blur-md text-white font-bold text-lg border border-slate-600 hover:bg-slate-700/80 hover:border-slate-400 transition-all shadow-xl hover:-translate-y-2 active:translate-y-1">
                SYSTEM SPECS
              </button>
            </div>
          </motion.div>

          {/* Bold Interactive 3D Graphic */}
          <div className="hidden lg:block w-full h-full">
             <InteractiveHeroGraphic />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="w-full max-w-[90rem] mx-auto py-40 px-4 sm:px-6 lg:px-8 relative z-10 perspective-[2000px]">
        <div className="text-center mb-24">
          <motion.h2 
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black mb-6 tracking-tight drop-shadow-2xl"
          >
            TACTICAL <span className="text-sky-500 drop-shadow-[0_0_20px_rgba(14,165,233,0.5)]">SUPERIORITY</span>
          </motion.h2>
          <p className="text-slate-400 text-xl max-w-3xl mx-auto font-medium">
            A fully integrated sensor-to-shooter ecosystem deployed in milliseconds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 100, rotateY: 45, scale: 0.8 }}
              whileInView={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, delay: idx * 0.2, type: "spring", bounce: 0.5 }}
            >
              <TiltCard className={`h-full bg-slate-900/60 backdrop-blur-xl border border-slate-700 hover:border-slate-500 p-10 group transition-all duration-300 ${feature.glow}`}>
                
                {/* 3D Floating Icon Container */}
                <div 
                  className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mb-8 border border-slate-600 shadow-2xl relative"
                  style={{ transform: "translateZ(60px)" }}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent rounded-2xl" />
                  {feature.icon}
                </div>

                {/* Extruded Text */}
                <h3 
                  className="text-2xl font-black mb-4 text-white"
                  style={{ transform: "translateZ(40px)" }}
                >
                  {feature.title}
                </h3>
                <p 
                  className="text-slate-400 text-base leading-relaxed font-medium"
                  style={{ transform: "translateZ(20px)" }}
                >
                  {feature.description}
                </p>

                {/* Decorative Tech Lines */}
                <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity" style={{ transform: "translateZ(10px)" }}>
                  <div className="w-12 h-[2px] bg-slate-600 mb-2" />
                  <div className="w-8 h-[2px] bg-slate-600 ml-auto" />
                </div>
              </TiltCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Download Center Section */}
      <section id="downloads" className="w-full max-w-[90rem] mx-auto py-40 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-24">
          <motion.h2 
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black mb-6 tracking-tight"
          >
            DEPLOYMENT <span className="text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">READY</span>
          </motion.h2>
          <p className="text-slate-400 text-xl max-w-3xl mx-auto font-medium">
            Equip your response teams with the latest WARDEN tactical applications.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Windows Apps */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="group"
          >
            <div className="h-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-10 rounded-[2.5rem] relative overflow-hidden transition-all hover:border-sky-500/50">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg viewBox="0 0 88 88" width="120" height="120" fill="currentColor"><path d="M0 12.402l35.687-4.86.016 34.423-35.67.203-.033-29.766zm35.67 33.529l.016 34.453-35.67-4.904-.016-29.78 35.67.231zm4.326-39.02l48.004-6.912v40.092l-48.004.414v-33.594zm48.004 37.607v40.355l-48.004-6.845v-33.88l48.004.37z"/></svg>
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30">
                    <svg viewBox="0 0 88 88" width="32" height="32" fill="#38bdf8"><path d="M0 12.402l35.687-4.86.016 34.423-35.67.203-.033-29.766zm35.67 33.529l.016 34.453-35.67-4.904-.016-29.78 35.67.231zm4.326-39.02l48.004-6.912v40.092l-48.004.414v-33.594zm48.004 37.607v40.355l-48.004-6.845v-33.88l48.004.37z"/></svg>
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-white">Desktop Suite</h3>
                    <p className="text-sky-400 font-mono text-sm">Windows 10/11 • v1.0.0</p>
                  </div>
                </div>

                <p className="text-slate-400 text-lg mb-6 leading-relaxed">
                  High-performance command and responder interfaces with integrated Local AI reasoning engines.
                </p>
                <div className="flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 w-fit">
                  <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                  <span className="text-[10px] uppercase tracking-widest font-bold text-sky-400">Includes Portable AI Engine (~3.1 GB)</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <a href="/downloads/warden-staff.zip" download="warden-staff.zip" className="flex-1 px-6 py-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-sky-500 hover:bg-slate-700 transition-all flex items-center justify-between group/btn">
                    <span className="font-bold">Staff Command</span>
                    <span className="text-xs text-slate-500 group-hover/btn:text-sky-400">3.1 GB</span>
                  </a>
                  <a href="/downloads/warden-responder.zip" download="warden-responder.zip" className="flex-1 px-6 py-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-sky-500 hover:bg-slate-700 transition-all flex items-center justify-between group/btn">
                    <span className="font-bold">Field Responder</span>
                    <span className="text-xs text-slate-500 group-hover/btn:text-sky-400">3.1 GB</span>
                  </a>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Android App */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="group"
          >
            <div className="h-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-10 rounded-[2.5rem] relative overflow-hidden transition-all hover:border-emerald-500/50">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg viewBox="0 0 24 24" width="120" height="120" fill="currentColor"><path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993s-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993s-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592c.1158-.2006.0467-.4566-.1539-.5724-.2006-.1158-.4566-.0467-.5724.1539l-2.0401 3.5332c-1.4241-.6507-3.0304-1.0152-4.7124-1.0152s-3.2883.3645-4.7124 1.0152L5.6477 5.4485c-.1158-.2006-.3718-.2697-.5724-.1539-.2006.1158-.2697.3718-.1539.5724l1.9973 3.4592C3.123 11.4239 0 16.0366 0 21.4018h24c0-5.3652-3.123-9.9779-6.9215-12.0804"/></svg>
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="#10b981"><path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993s-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993s-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592c.1158-.2006.0467-.4566-.1539-.5724-.2006-.1158-.4566-.0467-.5724.1539l-2.0401 3.5332c-1.4241-.6507-3.0304-1.0152-4.7124-1.0152s-3.2883.3645-4.7124 1.0152L5.6477 5.4485c-.1158-.2006-.3718-.2697-.5724-.1539-.2006.1158-.2697.3718-.1539.5724l1.9973 3.4592C3.123 11.4239 0 16.0366 0 21.4018h24c0-5.3652-3.123-9.9779-6.9215-12.0804"/></svg>
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-white">Mobile Unit</h3>
                    <p className="text-emerald-400 font-mono text-sm">Android 10+ • v1.0.0</p>
                  </div>
                </div>

                <p className="text-slate-400 text-lg mb-10 leading-relaxed">
                  Real-time alerts, SOS activation, and high-priority tactical navigation in the palm of your hand.
                </p>

                <a href="/downloads/warden-mobile.apk" download="warden-mobile.apk" className="block w-full px-6 py-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-emerald-500 hover:bg-slate-700 transition-all flex items-center justify-between group/btn">
                  <span className="font-bold">WARDEN Mobile APK</span>
                  <span className="text-xs text-slate-500 group-hover/btn:text-emerald-400">28 MB</span>
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 py-12 px-4 text-center text-slate-500 relative z-10 bg-[#020617]">
        <div className="flex items-center justify-center gap-2 mb-4">
          <ShieldAlert className="text-red-500 w-5 h-5" />
          <span className="font-bold text-slate-300 tracking-tight">WARDEN <span className="text-red-500">AI</span></span>
        </div>
        <p className="text-sm">© 2026 WARDEN Project • Intelligence in Crisis • Powered by Google Cloud</p>
      </footer>
    </div>
  );
}
