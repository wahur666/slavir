# Roadmap

## Scenes

- [x] Add loading screen
- [x] Create start menu scene
- [x] Add start button on menu scene

## UI

- [x] Add win graphics
- [x] Add loose graphics
- [x] Add pause menu
- [x] Add back to menu button
- [x] Add in game time timer
- [x] Add resource animation
- [x] Add Unit cool down animation
- [x] Add objective animation
- [x] Add rocket animation

## Tilemap

- [x] Replace ground texture
- [x] Replace obstacle texture
- [x] Make base texture ground texture
- [x] Make resource texture ground texture

## Building

- [x] Create building class
- [x] Make create building part of the user event listener
- [x] Add unit building requirement before creating units
- [x] Add base health
- [x] Hide enemy buildings when not visible

## Units

- [x] Configure attack animations
- [x] Configure attack animations cooldown time
- [x] Add stat info on card
- [x] Add health bar
- [x] Add building damage parameter
- [ ] Add unit groups (low priority)
- [x] Decrease unit help on damage
- [x] Make sure it cannot target itself
- [x] Harvester should not able to target units

## Gameplay

- [x] Add 3 sec delay before the game starts
- [ ] Add unit tracking to target
  - [x] Add dynamic obstacles
  - [ ] Recalculate navigation if needed
  - [x] Auto attack target if not attacking, and it is in range
  - [ ] Block targets, and make it to move to the closest tile
  - [ ] Move through friendly units, but prevent same end tile
  - [x] Move through enemy if its flying
- [x] Add resources
  - [x] Add sprite
  - [x] Add resource logic
    - (Date.now() - lastUpdate) * ( 5 / (5 - numOfHarvesters * 2) )
      - 5 sec no harvester
      - 3 sec 1 harvester
      - 1 sec 2 harvester
  - [x] Destroy resource on depletion
  - [x] Set newly created harvester target the next in line of priory resource
  - [x] Add bounty for killing harvester, 80
  - [x] Add start money 100
- [x] Add unit creation delay based on how many already existing
- [x] Add objective
  - [ ] Add sprite
  - [x] Add capture logic
  - [x] Add contesting logic
  - [x] Add timer, with 5 sec dominance for the end
  - [x] Add unit pad holding logic
- [ ] Add turret as commander power
- [x] Create unit cap 6
  - [x] Delay
    - 0 unit, 0 sec
    - 1 unit, 5 sec
    - 2 units, 10 sec
    - 3 units, 15 sec
    - 4 units, 20 sec
    - 5 units, 25 sec

## AI

- [x] Add unit creation logic
- [x] Add basic build order
- [x] Add basic counter logic

Target following now refreshes an attack order every 500 ms while the enemy remains visible.
Navigation work remains for blocked destinations, changing obstacles on movement orders,
and reserving separate destination tiles for friendly units.
