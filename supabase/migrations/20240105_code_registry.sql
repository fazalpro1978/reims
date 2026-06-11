-- ================================================================
-- Code Registry Migration + Seed — Vanguard REOS
-- Run once in Supabase Dashboard → SQL Editor (Production project)
-- ================================================================

CREATE TABLE IF NOT EXISTS cr_property_type_configs (
  type_code            VARCHAR(2)   PRIMARY KEY,
  core_type            VARCHAR(50)  NOT NULL,
  sub_type             VARCHAR(100) NOT NULL,
  configuration        VARCHAR(50)  NOT NULL,
  integration_scenario VARCHAR(100),
  features             TEXT
);

CREATE TABLE IF NOT EXISTS cr_entity_codes (
  entity_code   VARCHAR(3)   PRIMARY KEY,
  company_name  VARCHAR(250) NOT NULL,
  classification VARCHAR(100),
  is_manual     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cr_agents (
  agent_code VARCHAR(2)   PRIMARY KEY,
  full_name  VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS cr_zone_codes (
  zone_code     INTEGER      PRIMARY KEY,
  district_name VARCHAR(150) NOT NULL,
  municipality  VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS cr_sequence_counters (
  prefix   VARCHAR(9) PRIMARY KEY,
  next_seq INTEGER    NOT NULL DEFAULT 299
);

CREATE TABLE IF NOT EXISTS cr_registry (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  smart_code      VARCHAR(14)  UNIQUE NOT NULL,
  type_code       VARCHAR(2)   NOT NULL REFERENCES cr_property_type_configs(type_code),
  entity_code     VARCHAR(3)   NOT NULL REFERENCES cr_entity_codes(entity_code),
  agent_code      VARCHAR(2)   NOT NULL REFERENCES cr_agents(agent_code),
  zone_code       INTEGER      NOT NULL REFERENCES cr_zone_codes(zone_code),
  sequence_number INTEGER      NOT NULL,
  building_name   VARCHAR(200),
  floor_ref       VARCHAR(20),
  unit_ref        VARCHAR(50),
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT cr_smart_code_length CHECK (LENGTH(smart_code) = 14)
);

CREATE INDEX IF NOT EXISTS cr_registry_type_idx    ON cr_registry (type_code);
CREATE INDEX IF NOT EXISTS cr_registry_entity_idx  ON cr_registry (entity_code);
CREATE INDEX IF NOT EXISTS cr_registry_agent_idx   ON cr_registry (agent_code);
CREATE INDEX IF NOT EXISTS cr_registry_zone_idx    ON cr_registry (zone_code);
CREATE INDEX IF NOT EXISTS cr_registry_created_idx ON cr_registry (created_at DESC);

CREATE OR REPLACE VIEW cr_registry_full AS
SELECT
  r.id, r.smart_code,
  r.type_code, p.core_type, p.sub_type, p.configuration, p.integration_scenario,
  r.entity_code, e.company_name, e.classification, e.is_manual,
  r.agent_code, a.full_name AS agent_name,
  r.zone_code, z.district_name, z.municipality,
  r.sequence_number, r.building_name, r.floor_ref, r.unit_ref, r.notes, r.created_at
FROM cr_registry r
JOIN cr_property_type_configs p ON r.type_code  = p.type_code
JOIN cr_entity_codes          e ON r.entity_code = e.entity_code
JOIN cr_agents                a ON r.agent_code  = a.agent_code
JOIN cr_zone_codes            z ON r.zone_code   = z.zone_code;

CREATE OR REPLACE FUNCTION cr_generate_smart_code(
  p_type_code     TEXT,
  p_entity_code   TEXT,
  p_agent_code    TEXT,
  p_zone_code     INTEGER,
  p_building_name TEXT DEFAULT NULL,
  p_floor_ref     TEXT DEFAULT NULL,
  p_unit_ref      TEXT DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
) RETURNS TABLE(smart_code TEXT, sequence_number INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_zone_padded TEXT;
  v_prefix      TEXT;
  v_seq         INTEGER;
  v_code        TEXT;
BEGIN
  v_zone_padded := LPAD(p_zone_code::TEXT, 2, '0');
  v_prefix      := p_type_code || p_entity_code || p_agent_code || v_zone_padded;

  INSERT INTO cr_sequence_counters (prefix, next_seq)
  VALUES (v_prefix, 299)
  ON CONFLICT (prefix) DO NOTHING;

  SELECT cs.next_seq INTO v_seq
  FROM cr_sequence_counters cs
  WHERE cs.prefix = v_prefix
  FOR UPDATE;

  UPDATE cr_sequence_counters
  SET next_seq = next_seq + 1
  WHERE cr_sequence_counters.prefix = v_prefix;

  v_code := v_prefix || LPAD(v_seq::TEXT, 5, '0');

  INSERT INTO cr_registry (
    smart_code, type_code, entity_code, agent_code, zone_code,
    sequence_number, building_name, floor_ref, unit_ref, notes
  ) VALUES (
    v_code, p_type_code, p_entity_code, p_agent_code, p_zone_code,
    v_seq, p_building_name, p_floor_ref, p_unit_ref, p_notes
  );

  RETURN QUERY SELECT v_code, v_seq;
END;
$$;

GRANT ALL ON cr_property_type_configs TO service_role, anon, authenticated;
GRANT ALL ON cr_entity_codes          TO service_role, anon, authenticated;
GRANT ALL ON cr_agents                TO service_role, anon, authenticated;
GRANT ALL ON cr_zone_codes            TO service_role, anon, authenticated;
GRANT ALL ON cr_sequence_counters     TO service_role, anon, authenticated;
GRANT ALL ON cr_registry              TO service_role, anon, authenticated;
GRANT ALL ON cr_registry_full         TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION cr_generate_smart_code TO service_role, anon, authenticated;

-- ── Seed: Property Type Configs ──────────────────────────────────────
INSERT INTO cr_property_type_configs (type_code, core_type, sub_type, configuration, integration_scenario, features) VALUES
  ('ST','Apartment','Standard Apartment (Flat)','Studio','Residential Tower / Block','Open-plan kitchen/living space. Standard low, mid, or high-rise urban unit.'),
  ('1B','Apartment','Standard Apartment (Flat)','1 BHK','Residential Tower / Block','One separate bedroom with independent hall/living area and kitchen.'),
  ('2B','Apartment','Standard Apartment (Flat)','2 BHK','Residential Tower / Block','Two bedrooms, standard living hall. Core layout for executive couples and small families.'),
  ('3B','Apartment','Standard Apartment (Flat)','3 BHK','Premium High-Rise Tower','Three separate bedrooms. Higher-end units frequently build in an attached maid''s room.'),
  ('4B','Apartment','Standard Apartment (Flat)','4+ BHK','Premium High-Rise Tower','Large-format family flats occupying premium floor real estate.'),
  ('S0','Apartment','Serviced / Hotel Apartment','Studio','Luxury Hospitality Tower','Fully bundled hospitality units including all utilities, internet, and housekeeping.'),
  ('S1','Apartment','Serviced / Hotel Apartment','1 BHK','Luxury Hospitality Tower','Furnished executive corporate suites with full access to hotel amenities.'),
  ('S2','Apartment','Serviced / Hotel Apartment','2 BHK','Luxury Hospitality Tower','Premium mid-size corporate serviced flats located in prominent central business hubs.'),
  ('S3','Apartment','Serviced / Hotel Apartment','3 BHK','Luxury Hospitality Tower','Large family-format hotel suites heavily targeted for extended luxury stays.'),
  ('P3','Apartment','Penthouse','3 BHK','Tower Crown / Top Floors','High-end layout situated exclusively on the highest floors of landmark towers.'),
  ('P4','Apartment','Penthouse','4 BHK','Tower Crown / Top Floors','Expansive elite layout with private elevator lobbies and floor-to-ceiling panoramic views.'),
  ('P5','Apartment','Penthouse','5+ BHK','Tower Crown / Top Floors','Ultra-luxury massive footprint units. High-frequency option for high-net-worth investors.'),
  ('D2','Apartment','Duplex','2 BHK','Multi-Level Tower Unit','Two-story configuration connected via internal private staircase inside a high-rise structure.'),
  ('D3','Apartment','Duplex','3 BHK','Multi-Level Tower Unit','Provides the layout feel of an integrated townhouse within a premium urban tower environment.'),
  ('V0','Apartment','Villa Apartment','Studio','Partitioned Independent Villa','Localized division of a massive private villa plot into a single standalone self-contained room.'),
  ('V1','Apartment','Villa Apartment','1 BHK','Partitioned Independent Villa','A separate section of a large villa with independent entry and kitchen setup.'),
  ('V2','Apartment','Villa Apartment','2 BHK','Partitioned Independent Villa','Multi-room structural partition of an independent villa sharing main entry gates.'),
  ('LF','Apartment','Loft','1 BHK','Urban Double-Height Space','Industrial-style open plan with double-height ceiling and elevated bedroom mezzanine.'),
  ('A3','Villa','Stand-Alone Villa','3 BHK','Independent Private Plot','Fully detached villa built entirely on an individual private plot with standalone yard boundaries.'),
  ('A4','Villa','Stand-Alone Villa','4 BHK','Independent Private Plot','Detached private layout with independent access, garage spaces, and private yard/garden.'),
  ('A5','Villa','Stand-Alone Villa','5 BHK','Independent Private Plot','Spacious luxury layout often featuring private swimming pools, outbuildings, or elevators.'),
  ('A6','Villa','Stand-Alone Villa','6+ BHK','Independent Private Plot','Grand high-capacity layout built for large multi-generational domestic occupancy.'),
  ('C3','Villa','Compound Villa','3 BHK','Gated Residential Complex','Villas integrated inside a secured boundary with collective access to central clubhouses/gyms.'),
  ('C4','Villa','Compound Villa','4 BHK','Gated Residential Complex','Mid-size family option within a shared infrastructure and 24/7 manned security complex.'),
  ('C5','Villa','Compound Villa','5+ BHK','Gated Residential Complex','Large premium compound villa with communal access to shared tennis courts, parks, and large pools.'),
  ('T2','Villa','Townhouse','2 BHK','Planned Master Community','Compact row development sharing side walls, featuring private micro-yards or terraces.'),
  ('T3','Villa','Townhouse','3 BHK','Planned Master Community','Multi-story linear attached housing rows popular in highly master-planned communities.'),
  ('T4','Villa','Townhouse','4 BHK','Planned Master Community','Larger layout variant in a row structure balancing size with centralized community living.'),
  ('W3','Villa','Twin House','3 BHK','Mirror-Image Semi-Detached','A pair of separate villas sharing one central primary structural building wall.'),
  ('W4','Villa','Twin House','4 BHK','Mirror-Image Semi-Detached','Semi-detached layout where two symmetric mirror properties occupy a dual-plot setup.'),
  ('MR','System Add-On','Room Filter Extension','+ Maid''s Room','En-Suite Suite Integration','Dedicated auxiliary domestic room built directly adjacent to the kitchen or unit back entrance.'),
  ('DR','System Add-On','Room Filter Extension','+ Driver''s Room','External / Garage Plot','Detached structural room built close to primary parking arrays, common in standalone villas.'),
  ('SO','System Add-On','Room Filter Extension','+ Study / Office','Flexible Workspace Alcove','Compact utility room configured without wardrobes to satisfy professional remote-work search patterns.')
ON CONFLICT (type_code) DO NOTHING;

-- ── Seed: Entity Codes ───────────────────────────────────────────────
INSERT INTO cr_entity_codes (entity_code, company_name, classification, is_manual) VALUES
  ('QDR','Qatari Diar Real Estate Investment Company','Semi-Government & Master Developer',FALSE),
  ('UDC','United Development Company (UDC)','Semi-Government & Master Developer',FALSE),
  ('BWA','Barwa Real Estate Group','Semi-Government & Master Developer',FALSE),
  ('MSH','Mshereheb Properties','Semi-Government & Master Developer',FALSE),
  ('EZD','Ezdan Holding Group','Semi-Government & Master Developer',FALSE),
  ('MAZ','Mazaya Real Estate Development','Semi-Government & Master Developer',FALSE),
  ('ALF','Alfardan Properties','Elite Private Developer & Conglomerate',FALSE),
  ('ASM','Al Asmakh Real Estate Development','Elite Private Developer & Conglomerate',FALSE),
  ('AEM','Al Emadi Enterprises','Elite Private Developer & Conglomerate',FALSE),
  ('AAM','Aamal Company QSC','Elite Private Developer & Conglomerate',FALSE),
  ('AMN','Al Mana Real Estate','Elite Private Developer & Conglomerate',FALSE),
  ('EST','Estithmar Holding','Elite Private Developer & Conglomerate',FALSE),
  ('DAA','Dar Al Arkan Qataria','Elite Private Developer & Conglomerate',FALSE),
  ('JMJ','JMJ Group Holding','Elite Private Developer & Conglomerate',FALSE),
  ('AMD','Al Madar Holding','Elite Private Developer & Conglomerate',FALSE),
  ('BAS','Bin Al-Sheikh Holding','Elite Private Developer & Conglomerate',FALSE),
  ('LFB','The Loft Bureau Real Estate','Top International & Local Brokerage',FALSE),
  ('NPP','NelsonPark Property','Top International & Local Brokerage',FALSE),
  ('BTH','Betterhomes Qatar','Top International & Local Brokerage',FALSE),
  ('FGR','FGREALTY Qatar (Find Great Realty)','Top International & Local Brokerage',FALSE),
  ('TPG','The Pearl Gates','Top International & Local Brokerage',FALSE),
  ('CAP','Capstone Property','Top International & Local Brokerage',FALSE),
  ('STP','Steps Real Estate','Top International & Local Brokerage',FALSE),
  ('ABH','ABH Real Estate','Top International & Local Brokerage',FALSE),
  ('25S','25 Spaces Real Estate','Top International & Local Brokerage',FALSE),
  ('COR','Coreo Real Estate','Top International & Local Brokerage',FALSE),
  ('DIR','Direct Real Estate','Top International & Local Brokerage',FALSE),
  ('CRQ','Corporate Real Estate Qatar','Top International & Local Brokerage',FALSE),
  ('GKR','Golden Key Real Estate','Top International & Local Brokerage',FALSE),
  ('MRH','Maroon Homes','Top International & Local Brokerage',FALSE),
  ('PPQ','Premium Property Qatar','Top International & Local Brokerage',FALSE),
  ('DNQ','Danat Qatar','Institutional Property Manager',FALSE),
  ('AJR','Al Jazi Real Estate (Al Faisal Holding)','Institutional Property Manager',FALSE),
  ('UCR','Unicorn Real Estate','Institutional Property Manager',FALSE),
  ('MIG','Mirage International Property Consultants (MIPC)','Institutional Property Manager',FALSE),
  ('C1R','Capital One Real Estate','Institutional Property Manager',FALSE),
  ('RLQ','Realty Qatar','Institutional Property Manager',FALSE),
  ('ZRC','Zircon Real Estate','Institutional Property Manager',FALSE)
ON CONFLICT (entity_code) DO NOTHING;

-- ── Seed: Agents ─────────────────────────────────────────────────────
INSERT INTO cr_agents (agent_code, full_name) VALUES
  ('AA','Ahmed Ali'),
  ('AS','Abdul Shahan'),
  ('FM','Fazlue Mushaffik'),
  ('SB','Shihan Buhary'),
  ('NL','Nadeem Leeman')
ON CONFLICT (agent_code) DO NOTHING;

-- ── Seed: Zone Codes (90 zones, all Qatar municipalities) ───────────
INSERT INTO cr_zone_codes (zone_code, district_name, municipality) VALUES
  (1,'Al Jasrah','Doha Municipality'),
  (2,'Al Bidda','Doha Municipality'),
  (3,'Fereej Mohamed Bin Jassim / Musheireb','Doha Municipality'),
  (4,'Musheireb','Doha Municipality'),
  (5,'Al Najada / Barahat Al Jufairi','Doha Municipality'),
  (6,'Old Al Ghanim','Doha Municipality'),
  (7,'Al Souq','Doha Municipality'),
  (10,'Wadi Al Sail','Doha Municipality'),
  (11,'Rumeilah','Doha Municipality'),
  (12,'Al Bidda','Doha Municipality'),
  (13,'Musheireb','Doha Municipality'),
  (14,'Fereej Abdel Aziz','Doha Municipality'),
  (15,'Doha Al Jadeeda','Doha Municipality'),
  (16,'Old Al Ghanim','Doha Municipality'),
  (17,'Old Al Hitmi','Doha Municipality'),
  (18,'As Salatah / Al Mirqab','Doha Municipality'),
  (19,'Doha Port','Doha Municipality'),
  (20,'Wadi Al Sail','Doha Municipality'),
  (21,'Rumeilah','Doha Municipality'),
  (22,'Fereej Bin Mahmoud','Doha Municipality'),
  (23,'Fereej Bin Mahmoud','Doha Municipality'),
  (24,'Rawdat Al Khail','Doha Municipality'),
  (25,'Al Mansoura / Bin Dirham','Doha Municipality'),
  (26,'Najma','Doha Municipality'),
  (27,'Umm Ghuwailina','Doha Municipality'),
  (28,'Ras Abu Aboud / Al Khulaifat','Doha Municipality'),
  (30,'Duhail','Doha Municipality'),
  (31,'Umm Lekhba','Doha Municipality'),
  (32,'Madinat Khalifa North / Dahl Al Hamam','Doha Municipality'),
  (33,'Al Markhiya','Doha Municipality'),
  (34,'Madinat Khalifa South','Doha Municipality'),
  (35,'Fereej Kulaib','Doha Municipality'),
  (36,'Al Messila','Doha Municipality'),
  (37,'Bin Omran / Hamad Medical City','Doha Municipality'),
  (38,'Al Sadd','Doha Municipality'),
  (39,'Al Sadd / New Al Mirqab / Fereej Al Nasr','Doha Municipality'),
  (40,'New Salata','Doha Municipality'),
  (41,'Nuaija','Doha Municipality'),
  (42,'Al Hilal','Doha Municipality'),
  (43,'Nuaija','Doha Municipality'),
  (44,'Nuaija','Doha Municipality'),
  (45,'Old Airport','Doha Municipality'),
  (46,'Al Thumama','Doha Municipality'),
  (47,'Al Thumama','Doha Municipality'),
  (48,'Doha International Airport','Doha Municipality'),
  (49,'Airport Area','Doha Municipality'),
  (50,'Zone 50','Doha Municipality'),
  (51,'Abu Hamour','Al Rayyan Municipality'),
  (52,'Muaither','Al Rayyan Municipality'),
  (53,'Al Waab','Al Rayyan Municipality'),
  (54,'Al Rayyan Al Jadeed','Al Rayyan Municipality'),
  (55,'Fereej Al Amir','Al Rayyan Municipality'),
  (56,'Ain Khaled','Al Rayyan Municipality'),
  (57,'Industrial Area','Doha Municipality'),
  (58,'Zone 58','Doha Municipality'),
  (60,'Al Dafna','Doha Municipality'),
  (61,'Al Dafna / Al Qassar','Doha Municipality'),
  (63,'Onaiza','Doha Municipality'),
  (64,'Lejbailat','Doha Municipality'),
  (65,'Onaiza','Doha Municipality'),
  (66,'Legtaifiya / Al Qassar / Onaiza','Doha Municipality'),
  (67,'Hazm Al Markhiya','Doha Municipality'),
  (68,'Jelaiah / Al Tarfa','Doha Municipality'),
  (69,'Lusail / Jabal Thuaileb / Al Kharayej','Al Daayen Municipality'),
  (70,'Umm Qarn / Simaisma Areas','Al Daayen Municipality'),
  (71,'Umm Salal Mohammed / Umm Salal Ali','Umm Salal Municipality'),
  (72,'Al Shahaniya','Al Shahaniya Municipality'),
  (73,'Dukhan','Al Shahaniya Municipality'),
  (74,'Al Khor','Al Khor & Al Thakhira Municipality'),
  (75,'Al Thakhira','Al Khor & Al Thakhira Municipality'),
  (76,'Ras Laffan','Al Khor & Al Thakhira Municipality'),
  (77,'Madinat Ash Shamal','Al Shamal Municipality'),
  (78,'Ar Ruwais','Al Shamal Municipality'),
  (79,'Abu Dhalouf / Al Zubarah','Al Shamal Municipality'),
  (80,'Al Jemailiya','Al Shahaniya Municipality'),
  (81,'Gharrafat Al Rayyan','Al Rayyan Municipality'),
  (82,'Rawdat Rashed','Al Shahaniya Municipality'),
  (83,'Bani Hajer','Al Rayyan Municipality'),
  (84,'Mukaynis','Al Shahaniya Municipality'),
  (85,'Umm Bab Areas','Al Shahaniya Municipality'),
  (86,'Remote Western Areas','Al Shahaniya Municipality'),
  (90,'Al Wakrah','Al Wakrah Municipality'),
  (91,'Al Wukair','Al Wakrah Municipality'),
  (92,'Mesaieed','Al Wakrah Municipality'),
  (93,'Sealine / Mesaieed South','Al Wakrah Municipality'),
  (94,'Al Karaana','Al Wakrah Municipality'),
  (95,'Al Adaid (Inland Sea)','Al Wakrah Municipality'),
  (96,'Abu Samra','Al Rayyan Municipality'),
  (97,'Umm Bab / Remote Areas','Al Rayyan Municipality'),
  (98,'New Development Areas','Al Wakrah Municipality')
ON CONFLICT (zone_code) DO NOTHING;
