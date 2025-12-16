import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import Expense from '../models/Expense';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

// Get all expenses with pagination and filtering
export const getAllExpenses = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { 
    page = 1, 
    limit = 50, 
    category, 
    startDate, 
    endDate,
    sortBy = 'date',
    sortOrder = 'desc'
  } = req.query;

  const query: any = {};
  
  // Filter by category
  if (category && category !== 'all') {
    query.category = category;
  }
  
  // Filter by date range
  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = new Date(startDate as string);
    }
    if (endDate) {
      query.date.$lte = new Date(endDate as string);
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const sort: any = {};
  sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

  const [expenses, total] = await Promise.all([
    Expense.find(query)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Expense.countDocuments(query)
  ]);

  // Calculate summary statistics
  const totalAmount = await Expense.aggregate([
    { $match: query },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  const categorySummary = await Expense.aggregate([
    { $match: query },
    { 
      $group: { 
        _id: '$category', 
        count: { $sum: 1 }, 
        totalAmount: { $sum: '$amount' } 
      } 
    },
    { $sort: { totalAmount: -1 } }
  ]);

  return res.status(200).json({
    success: true,
    data: {
      expenses,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
        itemsPerPage: Number(limit)
      },
      summary: {
        totalAmount: totalAmount[0]?.total || 0,
        totalExpenses: total,
        categorySummary
      }
    }
  });
});

// Get single expense by ID
export const getExpenseById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const expense = await Expense.findById(id);
  
  if (!expense) {
    return res.status(404).json({
      success: false,
      message: 'Expense not found'
    });
  }

  return res.status(200).json({
    success: true,
    data: expense
  });
});

// Create new expense
export const createExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }

  const { date, amount, details, category } = req.body;
  const createdBy = req.user?.username;

  const expense = new Expense({
    date: new Date(date),
    amount: Number(amount),
    details: details.trim(),
    category,
    createdBy
  });

  await expense.save();

  console.log(`💰 New expense created: ₱${amount} - ${details} (${category}) by ${createdBy}`);

  return res.status(201).json({
    success: true,
    message: 'Expense created successfully',
    data: expense
  });
});

// Update expense
export const updateExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const { date, amount, details, category } = req.body;

  const expense = await Expense.findById(id);
  
  if (!expense) {
    return res.status(404).json({
      success: false,
      message: 'Expense not found'
    });
  }

  expense.date = new Date(date);
  expense.amount = Number(amount);
  expense.details = details.trim();
  expense.category = category;

  await expense.save();

  console.log(`✏️ Expense updated: ${id} - ₱${amount} - ${details} by ${req.user?.username}`);

  return res.status(200).json({
    success: true,
    message: 'Expense updated successfully',
    data: expense
  });
});

// Delete expense
export const deleteExpense = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const expense = await Expense.findById(id);
  
  if (!expense) {
    return res.status(404).json({
      success: false,
      message: 'Expense not found'
    });
  }

  await Expense.findByIdAndDelete(id);

  console.log(`🗑️ Expense deleted: ${id} - ₱${expense.amount} - ${expense.details} by ${req.user?.username}`);

  return res.status(200).json({
    success: true,
    message: 'Expense deleted successfully'
  });
});

// Get expense categories
export const getExpenseCategories = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Predefined categories that should always be available
  const predefinedCategories = [
    'App Service Fee',
    'Court Maintenance',
    'Court Service',
    'Delivery Fee',
    'Financial Donation',
    'Mineral Water',
    'Purchase - Lights',
    'Purchase - Miscellaneous',
    'Purchase - Tennis Net',
    'Tennis Score Board',
    'Tournament Expense',
    'Water System Project Expense'
  ];

  // Get additional categories from database
  const dbCategories = await Expense.distinct('category');

  // Combine and deduplicate
  const allCategories = [...new Set([...predefinedCategories, ...dbCategories])];

  return res.status(200).json({
    success: true,
    data: allCategories.sort()
  });
});

// Get expense statistics for dashboard
export const getExpenseStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { startDate, endDate } = req.query;
  
  const query: any = {};
  if (startDate || endDate) {
    query.date = {};
    if (startDate) {
      query.date.$gte = new Date(startDate as string);
    }
    if (endDate) {
      query.date.$lte = new Date(endDate as string);
    }
  }

  const [totalStats, monthlyStats, categoryStats] = await Promise.all([
    // Total stats
    Expense.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 },
          averageAmount: { $avg: '$amount' }
        }
      }
    ]),
    
    // Monthly breakdown
    Expense.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]),
    
    // Category breakdown
    Expense.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$category',
          amount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { amount: -1 } }
    ])
  ]);

  return res.status(200).json({
    success: true,
    data: {
      total: totalStats[0] || { totalAmount: 0, totalCount: 0, averageAmount: 0 },
      monthly: monthlyStats,
      categories: categoryStats
    }
  });
});

// Validation rules for expense operations
export const expenseValidationRules = [
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Invalid date format'),
    
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
    
  body('details')
    .notEmpty()
    .withMessage('Details are required')
    .trim()
    .isLength({ min: 3, max: 500 })
    .withMessage('Details must be between 3 and 500 characters'),
    
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn([
      'Purchase - Miscelleanous',
      'Delivery Fee',
      'Mineral Water',
      'Court Service',
      'Court Maintenance',
      'Purchase - Tennis Net',
      'Tennis Score Board',
      'Purchase - Lights',
      'Water System Project Expense',
      'Tournament Expense',
      'Financial Donation',
      'App Service Fee'
    ])
    .withMessage('Invalid category')
];