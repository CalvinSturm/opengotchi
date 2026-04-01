use serde::{Deserialize, Serialize};

pub const PET_SAVE_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetStateDto {
    pub version: u8,
    pub name: String,
    pub satiety: u8,
    pub fun: u8,
    pub cleanliness: u8,
    pub energy: u8,
    pub is_sleeping: bool,
    pub last_updated_at: String,
}

impl PetStateDto {
    pub fn starter(last_updated_at: String) -> Self {
        Self {
            version: PET_SAVE_VERSION,
            name: "Byte".to_string(),
            satiety: 78,
            fun: 72,
            cleanliness: 80,
            energy: 68,
            is_sleeping: false,
            last_updated_at,
        }
    }

    pub fn has_valid_core_fields(&self) -> bool {
        self.version == PET_SAVE_VERSION
            && !self.name.trim().is_empty()
            && self.satiety <= 100
            && self.fun <= 100
            && self.cleanliness <= 100
            && self.energy <= 100
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyPetState {
    pub name: String,
    pub satiety: u8,
    pub fun: u8,
    pub cleanliness: u8,
    pub energy: u8,
    pub is_sleeping: bool,
    pub last_updated_at_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyPetSaveEnvelope {
    pub version: u8,
    pub pet: LegacyPetState,
}
