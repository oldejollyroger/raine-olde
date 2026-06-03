// animations.js - UX Polish Components

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================
const ToastContext = React.createContext(null);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = React.useState([]);

  const addToast = React.useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' || toast.type === 'watched' ? '✓' : 
               toast.type === 'watchlist' ? '♡' : 
               toast.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    return { addToast: (msg) => console.log('Toast:', msg) };
  }
  return context;
};

// ============================================
// CONFETTI CELEBRATION
// ============================================
const Confetti = ({ active, onComplete }) => {
  const [particles, setParticles] = React.useState([]);

  React.useEffect(() => {
    if (!active) return;

    const colors = ['#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#fff'];
    const newParticles = [];

    for (let i = 0; i < 50; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        duration: Math.random() * 1 + 2
      });
    }

    setParticles(newParticles);

    const timer = setTimeout(() => {
      setParticles([]);
      if (onComplete) onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [active, onComplete]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="confetti-container">
      {particles.map(p => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.x}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size}px`
          }}
        />
      ))}
    </div>
  );
};

// ============================================
// SPARKLE EFFECT
// ============================================
const Sparkles = ({ active }) => {
  const [particles, setParticles] = React.useState([]);

  React.useEffect(() => {
    if (!active) return;

    const newParticles = [];
    for (let i = 0; i < 20; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: Math.random() * 0.5 + 0.5
      });
    }
    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 1500);
    return () => clearTimeout(timer);
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {particles.map(p => (
        <div
          key={p.id}
          className="sparkle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`
          }}
        />
      ))}
    </div>
  );
};

// ============================================
// DICE ROLL ANIMATION
// ============================================
const DiceRollAnimation = ({ isRolling }) => {
  if (!isRolling) return null;

  return (
    <div className="dice-roll-container">
      <div className="dice-roll">
        <div className="dice">
          <div className="dice-face dice-face-1"><span className="dice-dot"></span></div>
          <div className="dice-face dice-face-2"><span className="dice-dot"></span><span className="dice-dot"></span></div>
          <div className="dice-face dice-face-3"><span className="dice-dot"></span><span className="dice-dot"></span><span className="dice-dot"></span></div>
          <div className="dice-face dice-face-4"><span className="dice-dot"></span><span className="dice-dot"></span><span className="dice-dot"></span><span className="dice-dot"></span></div>
          <div className="dice-face dice-face-5"><span className="dice-dot"></span><span className="dice-dot"></span><span className="dice-dot"></span><span className="dice-dot"></span><span className="dice-dot"></span></div>
          <div className="dice-face dice-face-6"><span className="dice-dot"></span><span className="dice-dot"></span><span className="dice-dot"></span><span className="dice-dot"></span><span className="dice-dot"></span><span className="dice-dot"></span></div>
        </div>
      </div>
      <p className="dice-text">Finding your next watch...</p>
    </div>
  );
};

// ============================================
// SWIPE GESTURE HOOK
// ============================================
const useSwipeGesture = (onSwipeLeft, onSwipeRight, onSwipeUp, options = {}) => {
  const { threshold = 50, enabled = true } = options;
  const touchStart = React.useRef({ x: 0, y: 0 });
  const touchEnd = React.useRef({ x: 0, y: 0 });

  const onTouchStart = React.useCallback((e) => {
    if (!enabled) return;
    touchStart.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    };
  }, [enabled]);

  const onTouchMove = React.useCallback((e) => {
    if (!enabled) return;
    touchEnd.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    };
  }, [enabled]);

  const onTouchEnd = React.useCallback(() => {
    if (!enabled) return;
    
    const deltaX = touchEnd.current.x - touchStart.current.x;
    const deltaY = touchStart.current.y - touchEnd.current.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Only trigger horizontal swipes if they're clearly horizontal
    if (absDeltaX > absDeltaY && absDeltaX > threshold) {
      // FIXED: Reversed swipe logic
      // deltaX > 0 = swipe right, deltaX < 0 = swipe left
      if (deltaX > 0 && onSwipeRight) onSwipeRight();
      else if (deltaX < 0 && onSwipeLeft) onSwipeLeft();
    } else if (absDeltaY > absDeltaX && absDeltaY > threshold && deltaY > 0) {
      if (onSwipeUp) onSwipeUp();
    }

    touchStart.current = { x: 0, y: 0 };
    touchEnd.current = { x: 0, y: 0 };
  }, [enabled, threshold, onSwipeLeft, onSwipeRight, onSwipeUp]);

  return { onTouchStart, onTouchMove, onTouchEnd };
};

// ============================================
// SWIPE HINT
// ============================================
const SwipeHint = ({ show, onDismiss }) => {
  React.useEffect(() => {
    if (show) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <div className="swipe-hint" onClick={onDismiss}>
      <div className="swipe-hint-content">
        <span>← Back | Next →</span>
      </div>
    </div>
  );
}; 