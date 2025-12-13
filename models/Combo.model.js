import mongoose from 'mongoose';

const comboSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  items: [{
    name: String,
    quantity: Number,
    size: String
  }],
  price: {
    type: Number,
    required: true
  },
  originalPrice: Number,
  image: String,
  category: {
    type: String,
    enum: ['snack', 'beverage', 'meal', 'combo'],
    default: 'combo'
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  loyaltyPointsRequired: Number,
  soldCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default mongoose.model('Combo', comboSchema);
