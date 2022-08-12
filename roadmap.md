# Roadmap

## Scenes

- [ ] Create start menu scene

## UI

- [ ] Add win graphics
- [ ] Add loose graphics
- [ ] Add pause menu

## Tilemap

- [ ] Replace ground texture
- [ ] Replace obstacle texture
- [ ] Make base texture ground texture
- [ ] Make resource texture ground texture

## Building

- [ ] Create building class
- [ ] Make create building part of the user event listener
- [ ] Add unit building requirement before creating units
- [ ] Add base health
- [ ] Hide enemy buildings when not visible

## Units

- [ ] Configure attack animations
- [ ] Add stat info on card
- [ ] Add health bar
- [ ] Add building damage parameter
- [ ] Add unit groups (low priority)

## Gameplay

- [ ] Add unit tracking to target
  - [ ] Add dynamic obstacles
  - [ ] Recalculate navigation if needed
  - [ ] Auto attack target if not attacking, and it is in range
  - [ ] Block targets, and make it to move to the closest tile
  - [ ] Move through friendly units, but prevent same end tile
  - [ ] Move through enemy if its flying
- [ ] Add resources
  - [ ] Add sprite
  - [ ] Add resource logic
    - 5 sec no harvester
    - 4 sec 1 harvester
    - 3 sec 2 harvester
  - [ ] Destroy resource on depletion
  - [ ] Set newly created harvester target the next in line of priory resource
  - [ ] Add bounty for killing harvester
  - [ ] Add start money 100
- [ ] Add unit creation delay based on how many already existing
- [ ] Add objective
  - [ ] Add sprite
  - [ ] Add capture logic
  - [ ] Add contesting logic
  - [ ] Add timer, with 5 sec dominance for the end
- [ ] Add turret as commander power
- [ ] Create unit cap 6
  - [ ] Delay
    - 0 unit, 0 sec
    - 1 unit, 5 sec
    - 2 units, 10 sec
    - 3 units, 15 sec
    - 4 units, 20 sec
    - 5 units, 25 sec
    
## AI

- [ ] Add unit creation logic
- [ ] Add basic build order
- [ ] Add basic counter logic