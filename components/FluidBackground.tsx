import React, { useEffect, useRef } from 'react';
import WebGLFluid from 'webgl-fluid';

/**
 * WebGL Fluid Simulation Background
 * Uses Pavel Dobrý's WebGL-Fluid-Simulation via webgl-fluid npm package
 */
export const FluidBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Resize canvas to fill container
        const resizeCanvas = () => {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Initialize WebGL Fluid
        WebGLFluid(canvas, {
            SIM_RESOLUTION: 256,
            DYE_RESOLUTION: 1024,
            CAPTURE_RESOLUTION: 512,
            DENSITY_DISSIPATION: 0.97,
            VELOCITY_DISSIPATION: 0.3,
            PRESSURE: 0.8,
            PRESSURE_ITERATIONS: 20,
            CURL: 30,
            SPLAT_RADIUS: 0.2,
            SPLAT_FORCE: 3000,
            SHADING: true,
            COLORFUL: false,
            COLOR_UPDATE_SPEED: 10,
            PAUSED: false,
            BACK_COLOR: { r: 0, g: 0, b: 0 },
            TRANSPARENT: true,
            BLOOM: true,
            BLOOM_ITERATIONS: 8,
            BLOOM_RESOLUTION: 256,
            BLOOM_INTENSITY: 0.5,
            BLOOM_THRESHOLD: 0.6,
            BLOOM_SOFT_KNEE: 0.7,
            SUNRAYS: false,
        });

        // Simulate a click in the center to "activate" the simulation
        setTimeout(() => {
            const rect = canvas.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Dispatch a real-looking click event sequence
            canvas.dispatchEvent(new MouseEvent('mousedown', {
                clientX: centerX,
                clientY: centerY,
                bubbles: true,
                cancelable: true,
                view: window,
            }));

            canvas.dispatchEvent(new MouseEvent('mouseup', {
                clientX: centerX,
                clientY: centerY,
                bubbles: true,
                cancelable: true,
                view: window,
            }));
        }, 100);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{
                background: '#000000',
                touchAction: 'none'
            }}
        />
    );
};

export default FluidBackground;
