import * as React from 'react';
import { Calendar } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const DateInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  ({ className, ...props }, ref) => {
    return (
      <div className="relative">
        <Input
          ref={ref}
          type="date"
          className={cn('report-date-input pr-10', className)}
          {...props}
        />
        <Calendar
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-70"
          aria-hidden
        />
      </div>
    );
  }
);
DateInput.displayName = 'DateInput';

export { DateInput };
