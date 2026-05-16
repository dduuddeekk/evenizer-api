import { Test, TestingModule } from '@nestjs/testing';
import { EventService } from './event.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';

describe('EventService', () => {
  let service: EventService;
  let prisma: {
    $transaction: jest.Mock;
    event: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    favouriteEvent: {
      findMany: jest.Mock;
    };
  };
  let uploadService: {
    saveImage: jest.Mock;
  };

  const baseEvent = {
    id: 11,
    uuid: 'event-uuid',
    title: 'Sample Event',
    start: new Date('2026-05-16T10:00:00.000Z'),
    end: new Date('2026-05-16T12:00:00.000Z'),
    user: { uuid: 'user-uuid' },
    categories: [],
    eventLocations: [],
    ticketTiers: [],
    eventOrganizers: [],
    _count: { favouritedBy: 0, rundowns: 0 },
  };

  const secondEvent = {
    id: 12,
    uuid: 'event-uuid-2',
    title: 'Second Event',
    start: new Date('2026-05-17T10:00:00.000Z'),
    end: new Date('2026-05-17T12:00:00.000Z'),
    user: { uuid: 'user-uuid-2' },
    categories: [],
    eventLocations: [],
    ticketTiers: [],
    eventOrganizers: [],
    _count: { favouritedBy: 0, rundowns: 0 },
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (callback) => callback({
        event: {
          findFirst: jest.fn(),
          count: jest.fn(),
          findMany: jest.fn(),
        },
        favouriteEvent: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
        },
      })),
      event: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      favouriteEvent: {
        findMany: jest.fn(),
      },
    };

    uploadService = {
      saveImage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: PrismaService, useValue: prisma },
        { provide: UploadService, useValue: uploadService },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('marks event as favorited for logged-in users who saved it', async () => {
    prisma.$transaction.mockImplementationOnce(async (callback) => callback({
      event: {
        findFirst: jest.fn().mockResolvedValue(baseEvent),
      },
      favouriteEvent: {
        findFirst: jest.fn().mockResolvedValue({ id: 1 }),
      },
    }));

    const result = await service.getEventDetail({ id: 7, role: 'USER' }, 'event-uuid');

    expect(result).toMatchObject({
      uuid: 'event-uuid',
      userUuid: 'user-uuid',
      isFavorited: true,
    });
  });

  it('returns false when the logged-in user has not favorited the event', async () => {
    prisma.$transaction.mockImplementationOnce(async (callback) => callback({
      event: {
        findFirst: jest.fn().mockResolvedValue(baseEvent),
      },
      favouriteEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    }));

    const result = await service.getEventDetail({ id: 7, role: 'USER' }, 'event-uuid');

    expect(result).toMatchObject({
      uuid: 'event-uuid',
      isFavorited: false,
    });
  });

  it('marks each event in getAllEvents based on the logged-in user favourites', async () => {
    prisma.event.count.mockResolvedValueOnce(2);
    prisma.event.findMany.mockResolvedValueOnce([baseEvent, secondEvent]);

    prisma.favouriteEvent.findMany.mockResolvedValueOnce([
      { eventId: 11 },
    ]);

    const result = await service.getAllEvents(
      { id: 7, role: 'USER' },
      { page: 1, limit: 10 } as any,
    );

    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({ uuid: 'event-uuid', isFavorited: true });
    expect(result.data[1]).toMatchObject({ uuid: 'event-uuid-2', isFavorited: false });
  });
});
