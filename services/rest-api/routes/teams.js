const express = require('express');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// In-memory teams database
let teams = [
  {
    id: '1',
    name: 'Development Team',
    description: 'Core development team',
    members: ['1', '2'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// GET /api/teams - Get all teams
router.get('/', (req, res) => {
  res.json(teams);
});

// GET /api/teams/:id - Get team by ID
router.get('/:id', (req, res) => {
  const team = teams.find(t => t.id === req.params.id);
  
  if (!team) {
    return res.status(404).json({
      error: 'Team not found',
      message: `Team with ID ${req.params.id} does not exist`
    });
  }
  
  res.json(team);
});

// POST /api/teams - Create new team
router.post('/', (req, res) => {
  const { name, description, members = [] } = req.body;
  
  if (!name) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'Name is required'
    });
  }
  
  const newTeam = {
    id: uuidv4(),
    name,
    description: description || '',
    members,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  teams.push(newTeam);
  
  res.status(201).json({
    message: 'Team created successfully',
    team: newTeam
  });
});

// PUT /api/teams/:id - Update team
router.put('/:id', (req, res) => {
  const teamIndex = teams.findIndex(t => t.id === req.params.id);
  
  if (teamIndex === -1) {
    return res.status(404).json({
      error: 'Team not found',
      message: `Team with ID ${req.params.id} does not exist`
    });
  }
  
  const { name, description, members } = req.body;
  
  const updatedTeam = {
    ...teams[teamIndex],
    ...(name && { name }),
    ...(description !== undefined && { description }),
    ...(members && { members }),
    updatedAt: new Date().toISOString()
  };
  
  teams[teamIndex] = updatedTeam;
  
  res.json({
    message: 'Team updated successfully',
    team: updatedTeam
  });
});

// DELETE /api/teams/:id - Delete team
router.delete('/:id', (req, res) => {
  const teamIndex = teams.findIndex(t => t.id === req.params.id);
  
  if (teamIndex === -1) {
    return res.status(404).json({
      error: 'Team not found',
      message: `Team with ID ${req.params.id} does not exist`
    });
  }
  
  const deletedTeam = teams.splice(teamIndex, 1)[0];
  
  res.json({
    message: 'Team deleted successfully',
    team: deletedTeam
  });
});

// POST /api/teams/:id/members - Add member to team
router.post('/:id/members', (req, res) => {
  const team = teams.find(t => t.id === req.params.id);
  
  if (!team) {
    return res.status(404).json({
      error: 'Team not found',
      message: `Team with ID ${req.params.id} does not exist`
    });
  }
  
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'userId is required'
    });
  }
  
  if (team.members.includes(userId)) {
    return res.status(409).json({
      error: 'User already in team',
      message: 'User is already a member of this team'
    });
  }
  
  team.members.push(userId);
  team.updatedAt = new Date().toISOString();
  
  res.json({
    message: 'Member added successfully',
    team
  });
});

// DELETE /api/teams/:id/members/:userId - Remove member from team
router.delete('/:id/members/:userId', (req, res) => {
  const team = teams.find(t => t.id === req.params.id);
  
  if (!team) {
    return res.status(404).json({
      error: 'Team not found',
      message: `Team with ID ${req.params.id} does not exist`
    });
  }
  
  const memberIndex = team.members.indexOf(req.params.userId);
  
  if (memberIndex === -1) {
    return res.status(404).json({
      error: 'Member not found',
      message: 'User is not a member of this team'
    });
  }
  
  team.members.splice(memberIndex, 1);
  team.updatedAt = new Date().toISOString();
  
  res.json({
    message: 'Member removed successfully',
    team
  });
});

module.exports = router;
module.exports.teams = teams;
