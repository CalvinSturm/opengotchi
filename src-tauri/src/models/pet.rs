use serde::{Deserialize, Serialize};

pub const PET_SAVE_VERSION: u8 = 1;

fn default_health() -> u8 {
    84
}

fn default_waste() -> u8 {
    12
}

fn default_life_state() -> PetLifeState {
    PetLifeState::Alive
}

fn default_adult_milestone_progress() -> u32 {
    0
}

fn default_is_sick() -> bool {
    false
}

fn default_started_at() -> String {
    String::new()
}

fn default_care_score() -> u32 {
    0
}

fn default_care_mistakes() -> u32 {
    0
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PetAgeStage {
    #[default]
    Baby,
    Child,
    Teen,
    Adult,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PetLifeState {
    Egg,
    #[default]
    Alive,
    Dead,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PetAdultMilestone {
    SteadyRoutine,
    Showtime,
    SpringClean,
    RecoveryRun,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PetAdultOutcome {
    Balanced,
    Playful,
    Messy,
    Resilient,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PetStateDto {
    pub version: u8,
    pub name: String,
    pub satiety: u8,
    pub fun: u8,
    pub cleanliness: u8,
    pub energy: u8,
    #[serde(default = "default_health")]
    pub health: u8,
    #[serde(default = "default_waste")]
    pub waste: u8,
    #[serde(default = "default_life_state")]
    pub life_state: PetLifeState,
    #[serde(default = "default_is_sick")]
    pub is_sick: bool,
    pub is_sleeping: bool,
    #[serde(default = "default_started_at")]
    pub started_at: String,
    pub last_updated_at: String,
    #[serde(default)]
    pub age_stage: PetAgeStage,
    #[serde(default = "default_care_score")]
    pub care_score: u32,
    #[serde(default = "default_care_mistakes")]
    pub care_mistakes: u32,
    #[serde(default)]
    pub adult_outcome: Option<PetAdultOutcome>,
    #[serde(default)]
    pub adult_milestone: Option<PetAdultMilestone>,
    #[serde(default = "default_adult_milestone_progress")]
    pub adult_milestone_progress: u32,
    #[serde(default)]
    pub adult_milestone_completed_at: Option<String>,
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
            health: default_health(),
            waste: default_waste(),
            life_state: PetLifeState::Egg,
            is_sick: default_is_sick(),
            is_sleeping: false,
            started_at: last_updated_at.clone(),
            last_updated_at,
            age_stage: PetAgeStage::Baby,
            care_score: default_care_score(),
            care_mistakes: default_care_mistakes(),
            adult_outcome: None,
            adult_milestone: None,
            adult_milestone_progress: default_adult_milestone_progress(),
            adult_milestone_completed_at: None,
        }
    }

    pub fn has_valid_core_fields(&self) -> bool {
        self.version == PET_SAVE_VERSION
            && !self.name.trim().is_empty()
            && self.name.len() <= 32
            && self.satiety <= 100
            && self.fun <= 100
            && self.cleanliness <= 100
            && self.energy <= 100
            && self.health <= 100
            && self.waste <= 100
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_pet_state_dto_with_ipc_field_names() {
        let dto = PetStateDto {
            version: 1,
            name: "Byte".to_string(),
            satiety: 78,
            fun: 72,
            cleanliness: 80,
            energy: 68,
            health: 84,
            waste: 12,
            life_state: PetLifeState::Alive,
            is_sick: false,
            is_sleeping: false,
            started_at: "2026-04-01T12:00:00.000Z".to_string(),
            last_updated_at: "2026-04-01T17:00:00.000Z".to_string(),
            age_stage: PetAgeStage::Child,
            care_score: 14,
            care_mistakes: 2,
            adult_outcome: None,
            adult_milestone: Some(PetAdultMilestone::SteadyRoutine),
            adult_milestone_progress: 4,
            adult_milestone_completed_at: Some("2026-04-02T17:00:00.000Z".to_string()),
        };

        let value = serde_json::to_value(dto).expect("dto should serialize");

        assert_eq!(value["health"], 84);
        assert_eq!(value["waste"], 12);
        assert_eq!(value["lifeState"], "alive");
        assert_eq!(value["isSick"], false);
        assert_eq!(value["isSleeping"], false);
        assert_eq!(value["startedAt"], "2026-04-01T12:00:00.000Z");
        assert_eq!(value["lastUpdatedAt"], "2026-04-01T17:00:00.000Z");
        assert_eq!(value["ageStage"], "child");
        assert_eq!(value["careScore"], 14);
        assert_eq!(value["careMistakes"], 2);
        assert!(value["adultOutcome"].is_null());
        assert_eq!(value["adultMilestone"], "steady-routine");
        assert_eq!(value["adultMilestoneProgress"], 4);
        assert_eq!(value["adultMilestoneCompletedAt"], "2026-04-02T17:00:00.000Z");
        assert_eq!(value["version"], 1);
    }

    #[test]
    fn defaults_new_fields_when_loading_older_direct_save_shape() {
        let value = serde_json::json!({
            "version": 1,
            "name": "Byte",
            "satiety": 78,
            "fun": 72,
            "cleanliness": 80,
            "energy": 68,
            "isSleeping": false,
            "lastUpdatedAt": "2026-04-01T17:00:00.000Z"
        });

        let dto: PetStateDto = serde_json::from_value(value).expect("dto should deserialize");

        assert_eq!(dto.health, 84);
        assert_eq!(dto.waste, 12);
        assert_eq!(dto.life_state, PetLifeState::Alive);
        assert!(!dto.is_sick);
        assert_eq!(dto.started_at, "");
        assert_eq!(dto.age_stage, PetAgeStage::Baby);
        assert_eq!(dto.care_score, 0);
        assert_eq!(dto.care_mistakes, 0);
        assert_eq!(dto.adult_outcome, None);
        assert_eq!(dto.adult_milestone, None);
        assert_eq!(dto.adult_milestone_progress, 0);
        assert_eq!(dto.adult_milestone_completed_at, None);
    }
}
