'use client';

import { useState } from 'react';

interface Member {
  readonly name: string;
  readonly role: string;
}

interface Props {
  readonly onNext: () => void;
  readonly onBack: () => void;
}

export function Step2Team({ onNext, onBack }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMember = () => {
    if (!name.trim()) return;
    setMembers(prev => [...prev, { name: name.trim(), role: role.trim() }]);
    setName('');
    setRole('');
  };

  const removeMember = (index: number) => {
    setMembers(prev => prev.filter((_, i) => i !== index));
  };

  const handleNext = async () => {
    if (members.length === 0) { onNext(); return; }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/setup/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members }),
      });
      if (!res.ok) throw new Error('Failed to save team');
      onNext();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100">Who&apos;s on the team?</h1>

      <div className="space-y-2">
        {members.map((m, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg">
            <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{m.name}</span>
            {m.role && <span className="text-xs text-gray-400">{m.role}</span>}
            <button onClick={() => removeMember(i)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
        ))}

        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMember()}
            placeholder="Name"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30"
          />
          <input
            type="text"
            value={role}
            onChange={e => setRole(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMember()}
            placeholder="Role (optional)"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-node-hunch/30"
          />
          <button
            onClick={addMember}
            disabled={!name.trim()}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-40"
          >
            + Add
          </button>
        </div>
        <p className="text-xs text-gray-400">Everyone who&apos;ll use this system or frequently comes up in your work.</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
        <button
          onClick={handleNext}
          disabled={isLoading}
          className="px-6 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90"
        >
          {isLoading ? 'Saving...' : members.length === 0 ? 'Skip →' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
