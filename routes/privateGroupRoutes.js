const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const jsonPath = path.join(__dirname, '../data/private-groups.json');

function getGroups() {
  if (!fs.existsSync(jsonPath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function saveGroups(data) {
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * @route   GET /api/private-groups
 * @desc    Get all active private groups
 * @access  Public
 */
router.get('/', (req, res) => {
  try {
    const groups = getGroups();
    return res.status(200).json({
      success: true,
      data: groups
    });
  } catch (err) {
    logger.error('Get public private groups error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve groups'
    });
  }
});

/**
 * @route   POST /api/private-groups/:groupId/posts
 * @desc    Add a post to a private group
 * @access  Public
 */
router.post('/:groupId/posts', (req, res) => {
  try {
    const { groupId } = req.params;
    const { author, content } = req.body;

    if (!author || !content) {
      return res.status(400).json({ success: false, error: 'Author and content are required' });
    }

    const groups = getGroups();
    const groupIdx = groups.findIndex(g => g.id === groupId);

    if (groupIdx === -1) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    const newPost = {
      id: `post_${Date.now()}`,
      author,
      content,
      timestamp: 'Just now',
      likes: 0,
      comments: []
    };

    groups[groupIdx].posts = [newPost, ...(groups[groupIdx].posts || [])];
    saveGroups(groups);

    return res.status(201).json({
      success: true,
      data: newPost
    });
  } catch (err) {
    logger.error('Add post error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to create post' });
  }
});

/**
 * @route   POST /api/private-groups/:groupId/posts/:postId/comments
 * @desc    Add a comment to a post inside a group
 * @access  Public
 */
router.post('/:groupId/posts/:postId/comments', (req, res) => {
  try {
    const { groupId, postId } = req.params;
    const { author, content } = req.body;

    if (!author || !content) {
      return res.status(400).json({ success: false, error: 'Author and content are required' });
    }

    const groups = getGroups();
    const groupIdx = groups.findIndex(g => g.id === groupId);

    if (groupIdx === -1) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    const postIdx = groups[groupIdx].posts.findIndex(p => p.id === postId);
    if (postIdx === -1) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const newComment = {
      id: `comment_${Date.now()}`,
      author,
      content,
      timestamp: 'Just now'
    };

    if (!groups[groupIdx].posts[postIdx].comments) {
      groups[groupIdx].posts[postIdx].comments = [];
    }

    groups[groupIdx].posts[postIdx].comments.push(newComment);
    saveGroups(groups);

    return res.status(201).json({
      success: true,
      data: newComment
    });
  } catch (err) {
    logger.error('Add comment error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to add comment' });
  }
});

/**
 * @route   POST /api/private-groups/:groupId/posts/:postId/like
 * @desc    Like a post inside a group
 * @access  Public
 */
router.post('/:groupId/posts/:postId/like', (req, res) => {
  try {
    const { groupId, postId } = req.params;

    const groups = getGroups();
    const groupIdx = groups.findIndex(g => g.id === groupId);

    if (groupIdx === -1) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    const postIdx = groups[groupIdx].posts.findIndex(p => p.id === postId);
    if (postIdx === -1) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    groups[groupIdx].posts[postIdx].likes = (groups[groupIdx].posts[postIdx].likes || 0) + 1;
    saveGroups(groups);

    return res.status(200).json({
      success: true,
      data: groups[groupIdx].posts[postIdx]
    });
  } catch (err) {
    logger.error('Like post error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to like post' });
  }
});

/**
 * @route   POST /api/private-groups/:groupId/join
 * @desc    Join a private group
 * @access  Public
 */
router.post('/:groupId/join', (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberName } = req.body;

    if (!memberName) {
      return res.status(400).json({ success: false, error: 'Member name is required' });
    }

    const groups = getGroups();
    const groupIdx = groups.findIndex(g => g.id === groupId);

    if (groupIdx === -1) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    if (!groups[groupIdx].members.includes(memberName)) {
      groups[groupIdx].members.push(memberName);
      groups[groupIdx].memberCount = (groups[groupIdx].memberCount || 0) + 1;
      saveGroups(groups);
    }

    return res.status(200).json({
      success: true,
      data: groups[groupIdx]
    });
  } catch (err) {
    logger.error('Join group error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to join group' });
  }
});

/**
 * @route   POST /api/private-groups/:groupId/leave
 * @desc    Leave a private group
 * @access  Public
 */
router.post('/:groupId/leave', (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberName } = req.body;

    if (!memberName) {
      return res.status(400).json({ success: false, error: 'Member name is required' });
    }

    const groups = getGroups();
    const groupIdx = groups.findIndex(g => g.id === groupId);

    if (groupIdx === -1) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }

    if (groups[groupIdx].members.includes(memberName)) {
      groups[groupIdx].members = groups[groupIdx].members.filter(m => m !== memberName);
      groups[groupIdx].memberCount = Math.max(0, (groups[groupIdx].memberCount || 1) - 1);
      saveGroups(groups);
    }

    return res.status(200).json({
      success: true,
      data: groups[groupIdx]
    });
  } catch (err) {
    logger.error('Leave group error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to leave group' });
  }
});

module.exports = router;
