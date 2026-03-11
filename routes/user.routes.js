import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware.js';
import {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  searchUser
} from '../controllers/user.controller.js';

const router = express.Router();

// Search route - accessible by staff and admin
router.get('/search', protect, authorize('staff', 'admin'), searchUser);

// Admin-only routes
router.use(protect, authorize('admin'));

router.get('/', getAllUsers);
router.get('/:id', getUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
