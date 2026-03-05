/** @format */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
	motion,
	useMotionValueEvent,
	useReducedMotion,
	useScroll,
	useSpring,
	useTransform,
} from 'motion/react';
import './animation-sequence.css';
import React from 'react';

const FRAME_COUNT = 80;
const SECTION_HEIGHT_VH = 420;

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function drawCover(
	ctx: CanvasRenderingContext2D,
	image: HTMLImageElement,
	width: number,
	height: number,
	devicePixelRatio: number,
) {
	const imageWidth = image.naturalWidth || image.width;
	const imageHeight = image.naturalHeight || image.height;

	if (!imageWidth || !imageHeight) return;

	const displayScale = Math.max(width / imageWidth, height / imageHeight);
	const drawWidth = imageWidth * displayScale;
	const drawHeight = imageHeight * displayScale;
	const x = (width - drawWidth) * 0.5;
	const y = (height - drawHeight) * 0.5;

	const renderScale = Math.max(1, devicePixelRatio);
	const targetWidth = Math.max(1, Math.floor(width * renderScale));
	const targetHeight = Math.max(1, Math.floor(height * renderScale));
	const canvas = ctx.canvas as HTMLCanvasElement;

	if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
		canvas.width = targetWidth;
		canvas.height = targetHeight;
	}

	ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.clearRect(0, 0, width, height);
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, width, height);

	ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

export default function WorkstationScrollAnimation() {
	const containerRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const imagesRef = useRef<Array<HTMLImageElement | null>>(
		Array(FRAME_COUNT).fill(null),
	);
	const currentFrameRef = useRef(0);
	const lastDrawnFrameRef = useRef(-1);

	const shouldReduceMotion = useReducedMotion();
	const [loadedFrames, setLoadedFrames] = useState(0);

	const frameSources = useMemo(
		() =>
			Array.from(
				{ length: FRAME_COUNT },
				(_, index) =>
					`/sequence2/ezgif-frame-${String(index + 1).padStart(3, '0')}.jpg`,
			),
		[],
	);

	const { scrollYProgress } = useScroll({
		target: containerRef,
		offset: ['start start', 'end end'],
	});

	const smoothProgress = useSpring(scrollYProgress, {
		stiffness: 230,
		damping: 40,
		mass: 0.45,
	});

	const controlledProgress = shouldReduceMotion
		? scrollYProgress
		: smoothProgress;
	const frameMotionValue = useTransform(
		controlledProgress,
		[0, 1],
		[0, FRAME_COUNT - 1],
	);

	const drawFrame = (targetFrame: number) => {
		const canvas = canvasRef.current;

		if (!canvas) return;

		const ctx = canvas.getContext('2d', { alpha: false });

		if (!ctx) return;

		const clampedFrame = clamp(targetFrame, 0, FRAME_COUNT - 1);
		let image = imagesRef.current[clampedFrame];

		if (!image) {
			for (let offset = 1; offset < FRAME_COUNT; offset += 1) {
				const previous = clampedFrame - offset;
				const next = clampedFrame + offset;

				if (previous >= 0 && imagesRef.current[previous]) {
					image = imagesRef.current[previous];
					break;
				}

				if (next < FRAME_COUNT && imagesRef.current[next]) {
					image = imagesRef.current[next];
					break;
				}
			}
		}

		if (!image) return;

		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		const dpr = window.devicePixelRatio || 1;

		drawCover(ctx, image, width, height, dpr);
		currentFrameRef.current = clampedFrame;
		lastDrawnFrameRef.current = clampedFrame;
	};

	useEffect(() => {
		let mounted = true;

		const onFrameReady = (index: number, image: HTMLImageElement | null) => {
			if (!mounted) return;

			imagesRef.current[index] = image;
			setLoadedFrames((previous) => previous + 1);

			if (image && lastDrawnFrameRef.current < 0) {
				drawFrame(0);
			}
		};

		frameSources.forEach((src, index) => {
			const image = new Image();
			image.decoding = 'async';
			image.src = src;

			image.onload = async () => {
				if (!mounted) return;

				try {
					await image.decode();
				} catch {
					// Some browsers can reject decode even with a valid image.
				}

				onFrameReady(index, image);
			};

			image.onerror = () => {
				onFrameReady(index, null);
			};
		});

		return () => {
			mounted = false;
		};
	}, [frameSources]);

	useEffect(() => {
		const handleResize = () => {
			drawFrame(currentFrameRef.current);
		};

		handleResize();
		window.addEventListener('resize', handleResize, { passive: true });

		return () => {
			window.removeEventListener('resize', handleResize);
		};
	}, []);

	useMotionValueEvent(frameMotionValue, 'change', (latest) => {
		const targetFrame = Math.round(latest);

		if (targetFrame === lastDrawnFrameRef.current) return;

		drawFrame(targetFrame);
	});

	return (
		<section
			ref={containerRef}
			className='sequence-section'
			style={{ height: `${SECTION_HEIGHT_VH}vh` }}
			aria-label='Animacao de sequencia controlada por scroll'>
			<div className='sequence-sticky'>
				<canvas
					ref={canvasRef}
					className='sequence-canvas'
				/>

				<div className='sequence-hud'>
					<p className='sequence-eyebrow'>Scroll Motion</p>
					<h1 className='sequence-title'>
						Desca para controlar o video quadro a quadro
					</h1>
					<p className='sequence-copy'>
						{shouldReduceMotion
							? 'Modo de movimento reduzido ativo. Mantive a transicao mais direta.'
							: 'A sequencia responde ao scroll com suavizacao leve para reduzir trancos.'}
					</p>
					<div
						className='sequence-progress-track'
						aria-hidden='true'>
						<motion.div
							className='sequence-progress-fill'
							style={{ scaleX: scrollYProgress }}
						/>
					</div>
					<p className='sequence-status'>
						Frames carregados: {loadedFrames}/{FRAME_COUNT}
					</p>
				</div>
			</div>
		</section>
	);
}
