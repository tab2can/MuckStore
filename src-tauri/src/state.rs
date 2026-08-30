use crate::models::StoreSettings;
use crate::process::ProcessManager;
use parking_lot::Mutex;

pub struct AppState {
    pub settings: Mutex<StoreSettings>,
    pub processes: Mutex<ProcessManager>,
}

impl AppState {
    pub fn new(settings: StoreSettings) -> Self {
        Self {
            settings: Mutex::new(settings),
            processes: Mutex::new(ProcessManager::default()),
        }
    }
}
