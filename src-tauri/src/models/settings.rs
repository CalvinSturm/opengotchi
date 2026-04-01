use serde::{Deserialize, Serialize};

pub const SETTINGS_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsDto {
    pub version: u8,
    pub always_on_top: bool,
    pub notifications_enabled: bool,
}

impl SettingsDto {
    pub fn starter() -> Self {
        Self {
            version: SETTINGS_VERSION,
            always_on_top: false,
            notifications_enabled: true,
        }
    }

    pub fn is_valid(&self) -> bool {
        self.version == SETTINGS_VERSION
    }
}
