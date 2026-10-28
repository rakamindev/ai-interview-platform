// Hardware utilities for system detection and camera access

export enum ProctoringState {
    WAITING = "waiting",
    LOADING = "loading",
    PASSED = "passed",
    ERROR = "error",
}

export type HardwareCheckingProgress = {
    osAndBrowser: ProctoringState;
    internet: ProctoringState;
    camera: ProctoringState;
    audio: ProctoringState;
    microphone: ProctoringState;
};

export function getBrowserInfo() {
    const userAgent = navigator.userAgent;
    let browser = "Unknown";
    let version = "";
    if (/chrome|crios|crmo/i.test(userAgent)) {
        browser = "Chrome";
        version = userAgent.match(/(chrome|crios|crmo)\/([\d.]+)/i)?.[2] || "";
    } else if (/firefox|fxios/i.test(userAgent)) {
        browser = "Firefox";
        version = userAgent.match(/(firefox|fxios)\/([\d.]+)/i)?.[2] || "";
    } else if (/safari/i.test(userAgent)) {
        browser = "Safari";
        version = userAgent.match(/version\/([\d.]+)/i)?.[1] || "";
    } else if (/edg/i.test(userAgent)) {
        browser = "Edge";
        version = userAgent.match(/edg\/([\d.]+)/i)?.[1] || "";
    }
    return { browser, version };
}

export function getOSInfo() {
    const platform = navigator.platform;
    const userAgent = navigator.userAgent;
    let os = "Unknown";
    if (/Win/i.test(platform)) os = "Windows";
    else if (/Mac/i.test(platform)) os = "MacOS";
    else if (/Linux/i.test(platform)) os = "Linux";
    else if (/Android/i.test(userAgent)) os = "Android";
    else if (/iPhone|iPad|iPod/i.test(userAgent)) os = "iOS";
    return os;
}

export async function checkCamera(): Promise<MediaStream | null> {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { max: 640 },
                height: { max: 480 },
                frameRate: { max: 20 },
                facingMode: "user",
            },
            audio: true,
        });
        return stream;
    } catch {
        return null;
    }
}

export function getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

export function getCurrentDate(): string {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}
