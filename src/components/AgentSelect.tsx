import { useState, useRef, useEffect } from 'react';
import type { Agent } from '../types';
import AgentAvatar, { useSpriteMap } from './AgentAvatar';

interface AgentSelectProps {
  agents: Agent[];
  value: string;
  onChange: (agentId: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const ROLE_LABELS: Record<string, string> = {
  team_leader: '팀장',
  senior: '시니어',
  junior: '주니어',
  intern: '인턴',
};

export default function AgentSelect({
  agents,
  value,
  onChange,
  placeholder = '-- 담당자 없음 --',
  size = 'sm',
  className = '',
}: AgentSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const spriteMap = useSpriteMap(agents);
  const selected = agents.find((a) => a.id === value);

  const textSize = size === 'md' ? 'text-sm' : 'text-xs';
  const padY = size === 'md' ? 'py-2' : 'py-1';
  const avatarSize = size === 'md' ? 22 : 18;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-2 ${padY} rounded-lg border border-slate-600 bg-slate-700 ${textSize} text-slate-300 outline-none transition hover:border-slate-500 focus:border-blue-500`}
      >
        {selected ? (
          <>
            <AgentAvatar agent={selected} spriteMap={spriteMap} size={avatarSize} />
            <span className="truncate">{selected.name_ko || selected.name}</span>
            <span className="text-slate-500 text-[10px]">({ROLE_LABELS[selected.role] ?? selected.role})</span>
          </>
        ) : (
          <span className="text-slate-500">{placeholder}</span>
        )}
        <svg className="ml-auto w-3 h-3 text-slate-500 flex-shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-600 bg-slate-800 shadow-xl">
          {/* None option */}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-2 ${padY} ${textSize} text-slate-500 hover:bg-slate-700 transition-colors`}
          >
            {placeholder}
          </button>

          {agents.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => { onChange(a.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-2 ${padY} ${textSize} transition-colors ${
                a.id === value
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              <AgentAvatar agent={a} spriteMap={spriteMap} size={avatarSize} />
              <span className="truncate">{a.name_ko || a.name}</span>
              <span className="text-slate-500 text-[10px]">({ROLE_LABELS[a.role] ?? a.role})</span>
              {a.status === 'working' && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
