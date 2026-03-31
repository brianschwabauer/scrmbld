// A shared AudioContext and nodes for effects.
// These are initialized once and reused for all subsequent sound plays.
let audioContext: AudioContext | null = null;
let reverbNode: ConvolverNode | null = null;
let wetMixGain: GainNode | null = null; // Controls the volume of the sound sent to reverb
let dryMixGain: GainNode | null = null; // Controls the volume of the direct, "dry" sound

/**
 * Generates a synthetic impulse response to create a reverb effect.
 * This simulates the sound echoing in a large room, like a train station.
 * @param context The AudioContext to use.
 * @returns An AudioBuffer containing the generated impulse response.
 */
function createImpulseResponse(context: AudioContext): AudioBuffer | null {
	const sampleRate = context.sampleRate;
	const duration = 1.5; // seconds
	const decay = 3.5;
	const numChannels = 2; // stereo
	const frameCount = sampleRate * duration;

	const buffer = context.createBuffer(numChannels, frameCount, sampleRate);

	for (let channel = 0; channel < numChannels; channel++) {
		const channelData = buffer.getChannelData(channel);
		for (let i = 0; i < frameCount; i++) {
			// Generate white noise and apply an exponential decay envelope
			const noiseSample = Math.random() * 2 - 1;
			channelData[i] = noiseSample * Math.pow(1 - i / frameCount, decay);
		}
	}
	return buffer;
}

/**
 * Initializes the shared AudioContext and the audio graph for effects (reverb).
 * This function is called automatically on the first play request.
 */
export function initializeAudio(): void {
	if (audioContext) {
		return; // Already initialized
	}
	try {
		// Create the master AudioContext
		audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

		// Create gain nodes for controlling the dry/wet mix of the reverb
		dryMixGain = audioContext.createGain();
		wetMixGain = audioContext.createGain();

		// Set the mix levels (70% dry, 30% wet is a good starting point)
		dryMixGain.gain.value = 0.7;
		wetMixGain.gain.value = 0.5;

		// The dry signal goes directly to the output
		dryMixGain.connect(audioContext.destination);

		// Create the reverb effect using a ConvolverNode
		reverbNode = audioContext.createConvolver();
		const impulseResponse = createImpulseResponse(audioContext);
		if (impulseResponse) {
			reverbNode.buffer = impulseResponse;
			// The wet signal is routed through the reverb node, then to the output
			wetMixGain.connect(reverbNode);
			reverbNode.connect(audioContext.destination);
		} else {
			// If reverb fails, connect wet gain directly to avoid breaking the audio chain
			wetMixGain.connect(audioContext.destination);
		}
	} catch (e) {
		console.error('Web Audio API is not supported in this browser.', e);
	}
}

// ── Pre-rendered audio buffers ─────────────────────────────────────────────
// Click variants: bandpass-filtered noise with baked-in envelope, generated
// at different center frequencies for timbral variety. Reused across all
// tick playback to avoid per-tick buffer allocation and filter node creation.

const NUM_CLICK_VARIANTS = 8;
let clickVariants: AudioBuffer[] | null = null;
let cachedSwooshBuffer: AudioBuffer | null = null;
let cachedSampleRate = 0;

function ensureClickVariants(): AudioBuffer[] {
	if (clickVariants && cachedSampleRate === audioContext!.sampleRate) return clickVariants;
	const sr = audioContext!.sampleRate;
	cachedSampleRate = sr;
	clickVariants = [];

	const duration = 0.04;
	const samples = Math.ceil(sr * duration);

	for (let v = 0; v < NUM_CLICK_VARIANTS; v++) {
		const buf = audioContext!.createBuffer(1, samples, sr);
		const data = buf.getChannelData(0);

		// Generate white noise
		const noise = new Float32Array(samples);
		for (let i = 0; i < samples; i++) noise[i] = Math.random() * 2 - 1;

		// Apply biquad bandpass filter (direct digital filter, avoids runtime BiquadFilterNode)
		const freq = 5000 + (v / NUM_CLICK_VARIANTS) * 1000;
		const Q = 2;
		const w0 = (2 * Math.PI * freq) / sr;
		const alpha = Math.sin(w0) / (2 * Q);
		const b0 = alpha;
		const b2 = -alpha;
		const a0 = 1 + alpha;
		const a1 = -2 * Math.cos(w0);
		const a2 = 1 - alpha;

		let x1 = 0,
			x2 = 0,
			y1 = 0,
			y2 = 0;
		for (let i = 0; i < samples; i++) {
			const x = noise[i];
			const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
			data[i] = y;
			x2 = x1;
			x1 = x;
			y2 = y1;
			y1 = y;
		}

		// Bake gain envelope: 1ms attack, exponential decay to 0.0001 at 30ms
		for (let i = 0; i < samples; i++) {
			const t = i / sr;
			const env = t < 0.001 ? t / 0.001 : Math.pow(0.0001, (t - 0.001) / 0.029);
			data[i] *= env;
		}

		clickVariants.push(buf);
	}
	return clickVariants;
}

function ensureSwooshBuffer(): AudioBuffer {
	if (cachedSwooshBuffer && cachedSampleRate === audioContext!.sampleRate)
		return cachedSwooshBuffer;
	const sr = audioContext!.sampleRate;
	const duration = 0.3;
	const samples = Math.ceil(sr * duration);
	cachedSwooshBuffer = audioContext!.createBuffer(1, samples, sr);
	const data = cachedSwooshBuffer.getChannelData(0);
	for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
	return cachedSwooshBuffer;
}

// ── Batch playback ─────────────────────────────────────────────────────────

export interface SplitFlapSoundEntry {
	ticks: number;
	delay: number; // ms between each tick
	offset: number; // ms from now to start this sound
	volume: number;
}

/**
 * Efficiently schedules split-flap tick sounds for many letters at once.
 *
 * Uses pre-rendered click buffers (no per-tick buffer allocation or filter nodes)
 * and one shared GainNode per sound (not per tick) for volume variation.
 * Swooshes from sounds that end near the same time are merged.
 */
export function playSplitFlapBatch(sounds: SplitFlapSoundEntry[]): void {
	if (!audioContext || !dryMixGain || !wetMixGain) return;
	if (audioContext.state === 'suspended') audioContext.resume();
	if (sounds.length === 0) return;

	const clicks = ensureClickVariants();
	const swooshBuf = ensureSwooshBuffer();
	const now = audioContext.currentTime;
	const numVariants = clicks.length;

	const swooshCandidates: { time: number; vol: number }[] = [];

	for (const snd of sounds) {
		if (snd.ticks <= 0) continue;
		const startSec = snd.offset / 1000;
		const delaySec = snd.delay / 1000;

		// One GainNode per sound — volume automation shared across all its ticks.
		// Each tick sets the gain to a random volume; since the pre-rendered click
		// decays to zero within 30ms and STAG > 30ms, ticks don't overlap.
		const gain = audioContext.createGain();
		gain.gain.value = 0;
		gain.connect(dryMixGain);
		gain.connect(wetMixGain);

		for (let i = 0; i < snd.ticks; i++) {
			const tickTime = now + startSec + i * delaySec;
			const vol = (0.8 + (Math.random() - 0.5) * 0.2) * snd.volume;

			gain.gain.setValueAtTime(vol, tickTime);

			const source = audioContext.createBufferSource();
			source.buffer = clicks[Math.floor(Math.random() * numVariants)];
			source.connect(gain);
			source.start(tickTime);
		}

		const lastTickTime = now + startSec + (snd.ticks - 1) * delaySec;
		swooshCandidates.push({ time: lastTickTime + 0.02, vol: snd.volume });
	}

	// Merge swooshes that end within 200ms of each other
	swooshCandidates.sort((a, b) => a.time - b.time);
	const mergedSwooshes: { time: number; vol: number }[] = [];
	for (const s of swooshCandidates) {
		const last = mergedSwooshes[mergedSwooshes.length - 1];
		if (last && s.time - last.time < 0.2) {
			last.vol = Math.max(last.vol, s.vol);
			last.time = Math.max(last.time, s.time);
		} else {
			mergedSwooshes.push({ time: s.time, vol: s.vol });
		}
	}

	const swooshDuration = 0.3;
	for (const s of mergedSwooshes) {
		const source = audioContext.createBufferSource();
		source.buffer = swooshBuf;
		const filter = audioContext.createBiquadFilter();
		const gain = audioContext.createGain();
		source.connect(filter);
		filter.connect(gain);
		gain.connect(dryMixGain);
		gain.connect(wetMixGain);
		filter.type = 'bandpass';
		filter.Q.value = 2.5;
		filter.frequency.setValueAtTime(1000, s.time);
		filter.frequency.exponentialRampToValueAtTime(500, s.time + swooshDuration);
		const swooshVol = 0.1 * s.vol;
		gain.gain.setValueAtTime(0, s.time);
		gain.gain.linearRampToValueAtTime(swooshVol, s.time + 0.05);
		gain.gain.linearRampToValueAtTime(0, s.time + swooshDuration);
		source.start(s.time);
	}
}

/**
 * Plays a series of realistic split-flap "tick" sounds, followed by a final "swoosh" and "clunk".
 * This function can be called multiple times concurrently to simulate multiple letters changing at once.
 *
 * @param ticks The number of flaps to animate (i.e., the number of "tick" sounds).
 * @param delayMs The delay in milliseconds between each flap animation and sound.
 */
export function playSplitFlapSound(options?: {
	ticks?: number;
	delay?: number;
	volume?: number;
}): void {
	playSplitFlapBatch([
		{
			ticks: options?.ticks ?? 1,
			delay: options?.delay ?? 50,
			offset: 0,
			volume: options?.volume ?? 1,
		},
	]);
}

/**
 * Plays a bell-like "ding ding" sound to indicate a correct guess.
 * This sound is created by layering multiple sine waves to create rich harmonics.
 */
export function playSuccessSound(): void {
	// initializeAudio(); // We'll initialize audio on first pointer down to comply with browser policies
	if (!audioContext || !dryMixGain || !wetMixGain) return;
	if (audioContext.state === 'suspended') audioContext.resume();

	const now = audioContext.currentTime;

	// This helper function creates one "ding" sound.
	const createDing = (time: number, rootFrequency: number, volume: number) => {
		// Layering oscillators with non-integer frequency ratios creates a bell-like timbre.
		const osc1 = audioContext!.createOscillator();
		const osc2 = audioContext!.createOscillator();
		const gainNode = audioContext!.createGain();

		osc1.connect(gainNode);
		osc2.connect(gainNode);
		gainNode.connect(dryMixGain!);
		gainNode.connect(wetMixGain!);

		osc1.type = 'sine';
		osc2.type = 'sine';

		// Set frequencies (e.g., root and a note a fifth above it)
		osc1.frequency.value = rootFrequency;
		osc2.frequency.value = rootFrequency * 1.5;

		// A bell has a sharp attack and a long, gentle decay.
		gainNode.gain.setValueAtTime(0, time);
		gainNode.gain.linearRampToValueAtTime(volume, time + 0.02);
		gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 1.2);

		osc1.start(time);
		osc2.start(time);
		osc1.stop(time + 1.5);
		osc2.stop(time + 1.5);
	};

	// Play two dings in succession for a "ding ding" effect.
	createDing(now, 523.25, 0.3); // C5
	createDing(now + 0.2, 659.25, 0.25); // E5
	createDing(now + 0.4, 783.99, 0.2); // G5
}

/**
 * Plays a more complex failure sound that sweeps down to a low thud.
 */
export function playFailureSound(): void {
	// initializeAudio(); // We'll initialize audio on first pointer down to comply with browser policies
	if (!audioContext || !dryMixGain || !wetMixGain) return;
	if (audioContext.state === 'suspended') audioContext.resume();

	const now = audioContext.currentTime;

	// Component 1: The high-pitched descending sweep
	const sweepOsc = audioContext.createOscillator();
	const sweepGain = audioContext.createGain();

	sweepOsc.connect(sweepGain);
	sweepGain.connect(dryMixGain);
	sweepGain.connect(wetMixGain);

	sweepOsc.type = 'sawtooth';
	sweepOsc.frequency.setValueAtTime(250, now);
	sweepOsc.frequency.exponentialRampToValueAtTime(100, now + 0.9);

	sweepGain.gain.setValueAtTime(0.5, now);
	sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 1);

	sweepOsc.start(now);
	sweepOsc.stop(now + 1);

	// Component 2: The low "thud" at the end
	const thudOsc = audioContext.createOscillator();
	const thudGain = audioContext.createGain();
	const thudTime = now + 0.5; // Play the thud as the sweep ends

	thudOsc.connect(thudGain);
	thudGain.connect(dryMixGain);
	thudGain.connect(wetMixGain);

	thudOsc.type = 'sine';
	thudOsc.frequency.value = 200; // Low G2

	thudGain.gain.setValueAtTime(0, thudTime);
	thudGain.gain.linearRampToValueAtTime(1, thudTime + 0.02); // Sharp attack
	thudGain.gain.exponentialRampToValueAtTime(0.0001, thudTime + 0.2);

	thudOsc.start(thudTime);
	thudOsc.stop(thudTime + 0.3);
}
