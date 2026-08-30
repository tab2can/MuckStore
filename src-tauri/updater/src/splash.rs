use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;
use windows::core::{w, PCWSTR};
use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, RECT, WPARAM};
use windows::Win32::Graphics::Gdi::{
    BeginPaint, CreateFontW, CreateSolidBrush, DeleteObject, EndPaint, FillRect, InvalidateRect,
    SelectObject, SetBkMode, SetTextColor, TextOutW, HDC, HGDIOBJ, PAINTSTRUCT, TRANSPARENT,
    CLIP_DEFAULT_PRECIS, DEFAULT_CHARSET, FW_SEMIBOLD, OUT_TT_PRECIS, PROOF_QUALITY,
};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetClientRect, GetMessageW,
    GetSystemMetrics, KillTimer, LoadCursorW, MessageBoxW, PostQuitMessage, RegisterClassExW,
    SetTimer, ShowWindow, TranslateMessage, CS_HREDRAW, CS_VREDRAW, IDC_ARROW, MB_ICONERROR,
    MB_OK, MSG, SM_CXSCREEN, SM_CYSCREEN, SW_SHOW, WM_DESTROY, WM_PAINT, WM_TIMER, WNDCLASSEXW,
    WS_EX_APPWINDOW, WS_POPUP, WS_VISIBLE,
};

const COLOR_BG: u32 = 0x00110D0B;
const COLOR_ACCENT: u32 = 0x0056A0D4;
const COLOR_TEXT: u32 = 0x00E1E8EC;
const COLOR_MUTED: u32 = 0x00B5A39A;
const COLOR_TRACK: u32 = 0x00281518;
const WIN_W: i32 = 440;
const WIN_H: i32 = 248;

struct Inner {
    hwnd: Mutex<isize>,
    status: Mutex<String>,
    progress: AtomicU8,
    closed: AtomicBool,
}

static STATE: OnceLock<Arc<Inner>> = OnceLock::new();

#[derive(Clone)]
pub struct Splash {
    inner: Arc<Inner>,
}

impl Splash {
    pub fn show() -> Self {
        let inner = STATE
            .get_or_init(|| {
                Arc::new(Inner {
                    hwnd: Mutex::new(0),
                    status: Mutex::new("Checking for updates…".into()),
                    progress: AtomicU8::new(8),
                    closed: AtomicBool::new(false),
                })
            })
            .clone();
        let ui = inner.clone();
        thread::spawn(move || {
            if let Err(e) = unsafe { run_window(ui) } {
                eprintln!("updater window: {e}");
            }
        });
        for _ in 0..80 {
            if STATE.get().is_some_and(|s| *s.hwnd.lock().unwrap() != 0) {
                break;
            }
            thread::sleep(Duration::from_millis(16));
        }
        Self { inner }
    }

    pub fn set(&self, status: &str, progress: u8) {
        *self.inner.status.lock().unwrap() = status.to_string();
        self.inner
            .progress
            .store(progress.min(100), Ordering::Relaxed);
        let raw = *self.inner.hwnd.lock().unwrap();
        if raw != 0 {
            unsafe {
                let _ = InvalidateRect(Some(HWND(raw as *mut _)), None, false);
            }
        }
    }

    pub fn close(&self) {
        self.inner.closed.store(true, Ordering::Relaxed);
        let raw = *self.inner.hwnd.lock().unwrap();
        if raw != 0 {
            unsafe {
                let _ = DestroyWindow(HWND(raw as *mut _));
            }
        }
        thread::sleep(Duration::from_millis(50));
    }
}

pub fn alert(msg: &str) {
    let wide: Vec<u16> = msg.encode_utf16().chain([0]).collect();
    unsafe {
        let _ = MessageBoxW(
            None,
            PCWSTR(wide.as_ptr()),
            w!("Muck Store updater"),
            MB_OK | MB_ICONERROR,
        );
    }
}

unsafe fn run_window(state: Arc<Inner>) -> windows::core::Result<()> {
    let class = w!("MuckStoreUpdater");
    let instance = GetModuleHandleW(None)?;
    let wc = WNDCLASSEXW {
        cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
        style: CS_HREDRAW | CS_VREDRAW,
        lpfnWndProc: Some(wndproc),
        cbClsExtra: 0,
        cbWndExtra: 0,
        hInstance: instance.into(),
        hIcon: Default::default(),
        hCursor: LoadCursorW(None, IDC_ARROW)?,
        hbrBackground: CreateSolidBrush(COLORREF(COLOR_BG)),
        lpszMenuName: PCWSTR::null(),
        lpszClassName: class,
        hIconSm: Default::default(),
    };
    RegisterClassExW(&wc);

    let screen_w = GetSystemMetrics(SM_CXSCREEN);
    let screen_h = GetSystemMetrics(SM_CYSCREEN);
    let hwnd = CreateWindowExW(
        WS_EX_APPWINDOW,
        class,
        w!("Muck Store"),
        WS_POPUP | WS_VISIBLE,
        (screen_w - WIN_W) / 2,
        (screen_h - WIN_H) / 2,
        WIN_W,
        WIN_H,
        None,
        None,
        Some(instance.into()),
        None,
    )?;

    *state.hwnd.lock().unwrap() = hwnd.0 as isize;
    let _ = ShowWindow(hwnd, SW_SHOW);
    let _ = SetTimer(Some(hwnd), 1, 50, None);

    let mut msg = MSG::default();
    while GetMessageW(&mut msg, None, 0, 0).into() {
        let _ = TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }
    Ok(())
}

unsafe extern "system" fn wndproc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    match msg {
        WM_PAINT => {
            paint(hwnd);
            LRESULT(0)
        }
        WM_TIMER => {
            let _ = InvalidateRect(Some(hwnd), None, false);
            LRESULT(0)
        }
        WM_DESTROY => {
            let _ = KillTimer(Some(hwnd), 1);
            PostQuitMessage(0);
            LRESULT(0)
        }
        _ => DefWindowProcW(hwnd, msg, wparam, lparam),
    }
}

unsafe fn paint(hwnd: HWND) {
    let mut ps = PAINTSTRUCT::default();
    let hdc = BeginPaint(hwnd, &mut ps);
    let mut rc = RECT::default();
    let _ = GetClientRect(hwnd, &mut rc);

    let bg = CreateSolidBrush(COLORREF(COLOR_BG));
    let accent = CreateSolidBrush(COLORREF(COLOR_ACCENT));
    let track = CreateSolidBrush(COLORREF(COLOR_TRACK));
    FillRect(hdc, &rc, bg);
    let bar = RECT {
        left: 0,
        top: 0,
        right: 6,
        bottom: rc.bottom,
    };
    FillRect(hdc, &bar, accent);

    let status = STATE
        .get()
        .map(|s| s.status.lock().unwrap().clone())
        .unwrap_or_else(|| "Checking for updates…".into());
    let progress = STATE
        .get()
        .map(|s| s.progress.load(Ordering::Relaxed) as i32)
        .unwrap_or(8);

    let title = CreateFontW(
        22,
        0,
        0,
        0,
        FW_SEMIBOLD.0 as i32,
        0,
        0,
        0,
        DEFAULT_CHARSET,
        OUT_TT_PRECIS,
        CLIP_DEFAULT_PRECIS,
        PROOF_QUALITY,
        0,
        w!("Segoe UI"),
    );
    let body = CreateFontW(
        16,
        0,
        0,
        0,
        400,
        0,
        0,
        0,
        DEFAULT_CHARSET,
        OUT_TT_PRECIS,
        CLIP_DEFAULT_PRECIS,
        PROOF_QUALITY,
        0,
        w!("Segoe UI"),
    );

    SetBkMode(hdc, TRANSPARENT);
    SetTextColor(hdc, COLORREF(COLOR_ACCENT));
    let _ = SelectObject(hdc, HGDIOBJ(title.0));
    text_out(hdc, 28, 36, "MUCK STORE");

    SetTextColor(hdc, COLORREF(COLOR_TEXT));
    let _ = SelectObject(hdc, HGDIOBJ(body.0));
    text_out(hdc, 28, 78, "Looking for a newer installer on GitHub.");
    SetTextColor(hdc, COLORREF(COLOR_MUTED));
    text_out(hdc, 28, 108, &status);

    let track_rc = RECT {
        left: 28,
        top: 168,
        right: rc.right - 28,
        bottom: 176,
    };
    FillRect(hdc, &track_rc, track);
    let fill_w = ((track_rc.right - track_rc.left) * progress) / 100;
    let fill_rc = RECT {
        left: track_rc.left,
        top: track_rc.top,
        right: track_rc.left + fill_w.max(8),
        bottom: track_rc.bottom,
    };
    FillRect(hdc, &fill_rc, accent);

    let _ = DeleteObject(HGDIOBJ(bg.0));
    let _ = DeleteObject(HGDIOBJ(accent.0));
    let _ = DeleteObject(HGDIOBJ(track.0));
    let _ = DeleteObject(HGDIOBJ(title.0));
    let _ = DeleteObject(HGDIOBJ(body.0));
    let _ = EndPaint(hwnd, &ps);
}

fn text_out(hdc: HDC, x: i32, y: i32, s: &str) {
    let wide: Vec<u16> = s.encode_utf16().collect();
    unsafe {
        let _ = TextOutW(hdc, x, y, &wide);
    }
}
