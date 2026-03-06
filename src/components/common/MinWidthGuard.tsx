import { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';

const MIN_WIDTH = 1000;

export function MinWidthGuard({ children }: { children: React.ReactNode }) {
    const [tooNarrow, setTooNarrow] = useState(false);

    useEffect(() => {
        const check = () => setTooNarrow(window.innerWidth < MIN_WIDTH);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    if (tooNarrow) {
        return (
            <div
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'hsl(var(--background, 0 0% 100%))',
                    color: 'hsl(var(--foreground, 0 0% 0%))',
                    textAlign: 'center',
                    padding: '2rem',
                    gap: '1.5rem',
                }}
            >
                <Monitor style={{ width: 56, height: 56, opacity: 0.4 }} />
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        Screen Too Narrow
                    </h2>
                    <p style={{ fontSize: '0.95rem', opacity: 0.6, maxWidth: 360 }}>
                        This application requires a minimum screen width of <strong>{MIN_WIDTH}px</strong>.
                        Please resize your browser window or use a larger device.
                    </p>
                </div>
                <p style={{ fontSize: '0.8rem', opacity: 0.4 }}>
                    Current width: <strong>{window.innerWidth}px</strong>
                </p>
            </div>
        );
    }

    return <>{children}</>;
}
