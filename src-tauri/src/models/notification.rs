use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetNotificationDto {
    pub title: String,
    pub body: String,
}

impl PetNotificationDto {
    pub fn is_valid(&self) -> bool {
        !self.title.trim().is_empty() && !self.body.trim().is_empty()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PetReminderDto {
    pub key: String,
    pub title: String,
    pub body: String,
}

impl PetReminderDto {
    pub fn is_valid(&self) -> bool {
        !self.key.trim().is_empty()
            && self.key.len() <= 64
            && !self.title.trim().is_empty()
            && self.title.len() <= 120
            && !self.body.trim().is_empty()
            && self.body.len() <= 280
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetReminderSyncDto {
    pub notifications_enabled: bool,
    pub reminder: Option<PetReminderDto>,
}

impl PetReminderSyncDto {
    pub fn is_valid(&self) -> bool {
        self.reminder
            .as_ref()
            .map(PetReminderDto::is_valid)
            .unwrap_or(true)
    }
}
