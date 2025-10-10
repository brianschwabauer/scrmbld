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
	const ticks = options?.ticks ?? 1;
	const delayMs = options?.delay ?? 50;
	const volume = options?.volume ?? 1;

	if (ticks <= 0) return;

	initializeAudio();

	if (!audioContext || !dryMixGain || !wetMixGain) {
		console.warn('AudioContext not available. Sound cannot be played.');
		return;
	}

	if (audioContext.state === 'suspended') {
		audioContext.resume();
	}

	const now = audioContext.currentTime;
	const delaySec = delayMs / 1000;

	// Generate and Schedule the "Tick" Sounds
	for (let i = 0; i < ticks; i++) {
		const tickTime = now + i * delaySec;

		// Use a BufferSource with white noise to create a non-tonal sound source.
		const bufferSize = audioContext.sampleRate * 0.1; // 0.1s of noise is plenty
		const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
		const output = buffer.getChannelData(0);
		for (let j = 0; j < bufferSize; j++) {
			output[j] = Math.random() * 2 - 1;
		}

		const tickSource = audioContext.createBufferSource();
		tickSource.buffer = buffer;

		// A bandpass filter isolates a narrow band of frequencies from the noise,
		// creating a sharper, more defined "click" sound.
		const tickFilter = audioContext.createBiquadFilter();
		tickFilter.type = 'bandpass';
		tickFilter.frequency.value = 5000 + Math.random() * 1000; // Randomize for variety
		tickFilter.Q.value = 2; // A high Q value makes the click sharper

		const tickGain = audioContext.createGain();

		// Connect the audio graph for the tick sound
		tickSource.connect(tickFilter);
		tickFilter.connect(tickGain);
		tickGain.connect(dryMixGain);
		tickGain.connect(wetMixGain);

		// A very fast attack and decay envelope makes the sound percussive.
		const tickVolume = (0.8 + (Math.random() - 0.5) * 0.2) * volume;
		tickGain.gain.setValueAtTime(0, tickTime);
		tickGain.gain.linearRampToValueAtTime(tickVolume, tickTime + 0.001); // Extremely fast attack
		tickGain.gain.exponentialRampToValueAtTime(0.0001, tickTime + 0.03); // Quick decay

		tickSource.start(tickTime);
	}

	const lastTickTime = now + (ticks - 1) * delaySec;

	// Add a final "Swoosh" of air as the flap settles
	const swooshTime = lastTickTime + 0.02; // Start just after the last tick
	const swooshDuration = 0.3;

	// Generate white noise for the swoosh sound
	const bufferSize = audioContext.sampleRate * swooshDuration;
	const swooshBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
	const output = swooshBuffer.getChannelData(0);
	for (let i = 0; i < bufferSize; i++) {
		output[i] = Math.random() * 2 - 1;
	}

	const swooshSource = audioContext.createBufferSource();
	swooshSource.buffer = swooshBuffer;

	const swooshFilter = audioContext.createBiquadFilter();
	const swooshGain = audioContext.createGain();

	// Connect the swoosh audio chain
	swooshSource.connect(swooshFilter);
	swooshFilter.connect(swooshGain);
	swooshGain.connect(dryMixGain);
	swooshGain.connect(wetMixGain);

	// Automate filter frequency and gain to create the "swoosh" effect
	swooshFilter.type = 'bandpass';
	swooshFilter.Q.value = 2.5;
	swooshFilter.frequency.setValueAtTime(1000, swooshTime);
	swooshFilter.frequency.exponentialRampToValueAtTime(500, swooshTime + swooshDuration);

	const swooshVolume = 0.1 * volume;
	swooshGain.gain.setValueAtTime(0, swooshTime);
	swooshGain.gain.linearRampToValueAtTime(swooshVolume, swooshTime + 0.05); // Fade in
	swooshGain.gain.linearRampToValueAtTime(0, swooshTime + swooshDuration); // Fade out

	swooshSource.start(swooshTime);
}

/**
 * Plays a bell-like "ding ding" sound to indicate a correct guess.
 * This sound is created by layering multiple sine waves to create rich harmonics.
 */
export function playSuccessSound(): void {
	initializeAudio();
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
	initializeAudio();
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
