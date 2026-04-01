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
