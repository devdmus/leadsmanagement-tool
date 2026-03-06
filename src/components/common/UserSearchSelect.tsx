import { useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type UserOption = {
  id: string;
  username: string;
};

interface UserSearchSelectProps {
  users: UserOption[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function UserSearchSelect({
  users,
  value,
  onValueChange,
  disabled = false,
  placeholder = 'Select user',
}: UserSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedLabel =
    value === 'unassigned' || !value
      ? 'Unassigned'
      : users.find((u) => u.id === value)?.username ?? placeholder;

  const filtered = [
    { id: 'unassigned', username: 'Unassigned' },
    ...users,
  ].filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width,240px)] min-w-[200px] p-0"
        align="start"
        sideOffset={4}
      >
        {/* Search bar */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            className="flex-1 p-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search users..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>

        {/* Options list */}
        <div className="max-h-48 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No user found.</p>
          ) : (
            filtered.map((user) => {
              const isSelected =
                user.id === 'unassigned'
                  ? value === 'unassigned' || !value
                  : value === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer',
                    isSelected && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => {
                    onValueChange(user.id);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <Check className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                  {user.username}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
