/**
 * This module exports functions for creating and controlling audio effects for the app.
 * It encapsulates the Web Audio API logic for generating sounds programmatically.
 */
import { browser } from '$app/environment';

/**
 * The main audio context for the application. It is initialized to undefined and
 * created on the first user interaction to comply with browser audio policies.
 */
let audioContext: AudioContext | undefined;

/**
 * Initializes the audio context if it hasn't been created yet. This function
 * should be called in response to a user gesture, such as a click or keypress.
 *
 * @returns The initialized AudioContext instance.
 */
export function initAudioContext() {
	if (browser && !audioContext) {
		audioContext = new window.AudioContext();
	}
	return audioContext;
}

/**
 * Plays a short, slightly randomized "tick" sound to simulate the flap of a letter.
 * This function creates a simple sound using an oscillator and gain node, giving each
 * tick a unique pitch to avoid monotony.
 */
export function playTick() {
	if (!audioContext) return;
	const osc = audioContext.createOscillator();
	const gain = audioContext.createGain();
	const now = audioContext.currentTime;
	const tickLength = 0.05;

	// Configure the oscillator for a sharp, percussive sound
	osc.type = 'triangle';
	osc.frequency.setValueAtTime(1200 + Math.random() * 400, now); // Randomize pitch
	osc.connect(gain);

	// Shape the sound's volume envelope to create a "tick"
	gain.gain.setValueAtTime(0.3, now);
	gain.gain.exponentialRampToValueAtTime(0.001, now + tickLength); // Fade out quickly
	gain.connect(audioContext.destination);

	// Start and stop the oscillator
	osc.start(now);
	osc.stop(now + tickLength);
}

/**
 * Plays a "swoosh" sound effect, simulating the swinging of the flaps.
 * This is a more complex sound, created by modulating the frequency of an oscillator.
 */
export function playSwoosh() {
	if (!audioContext) return;
	const osc = audioContext.createOscillator();
	const gain = audioContext.createGain();
	const now = audioContext.currentTime;
	const swooshLength = 0.3;

	// Configure the oscillator for a "whoosh" sound
	osc.type = 'sawtooth';
	osc.frequency.setValueAtTime(200, now);
	osc.frequency.exponentialRampToValueAtTime(1500, now + swooshLength); // Sweep frequency up
	osc.connect(gain);

	// Shape the volume to be louder at the start and fade out
	gain.gain.setValueAtTime(0.01, now);
	gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.001, now + swooshLength);
	gain.connect(audioContext.destination);

	// Start and stop the sound
	osc.start(now);
	osc.stop(now + swooshLength);
}