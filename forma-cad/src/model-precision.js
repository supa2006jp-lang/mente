// All lengths are millimetres. Rendering/picking tolerances are deliberately
// separate from the native modelling and boolean contact policy.
export const MODEL_PRECISION=Object.freeze({version:1,zero:1e-9,topology:1e-7,contact:1e-6,angular:1e-6,relativeVolume:1e-8,minVolume:1e-8,microMax:.01,microMin:1e-5});
export const BOOLEAN_TOLERANCES=Object.freeze([0,MODEL_PRECISION.contact]);
export const isContactDistance=distance=>Number.isFinite(distance)&&distance>=0&&distance<=MODEL_PRECISION.contact;
export const volumeAllowance=volume=>Math.max(MODEL_PRECISION.minVolume,Math.abs(volume)*MODEL_PRECISION.relativeVolume);
export const microLength=diagonal=>Math.min(MODEL_PRECISION.microMax,Math.max(MODEL_PRECISION.microMin,Math.abs(diagonal)*1e-4));
