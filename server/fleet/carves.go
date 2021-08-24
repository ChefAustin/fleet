package fleet

import (
	"context"
	"time"
)

type CarveStore interface {
	NewCarve(metadata *CarveMetadata) (*CarveMetadata, error)
	UpdateCarve(metadata *CarveMetadata) error
	Carve(carveId int64) (*CarveMetadata, error)
	CarveBySessionId(sessionId string) (*CarveMetadata, error)
	CarveByName(name string) (*CarveMetadata, error)
	ListCarves(opt CarveListOptions) ([]*CarveMetadata, error)
	NewBlock(metadata *CarveMetadata, blockId int64, data []byte) error
	GetBlock(metadata *CarveMetadata, blockId int64) ([]byte, error)
	// CleanupCarves will mark carves older than 24 hours expired, and delete the
	// associated data blocks. This behaves differently for carves stored in S3
	// (check the implementation godoc comment for more details)
	CleanupCarves(now time.Time) (expired int, err error)
}

type CarveService interface {
	CarveBegin(ctx context.Context, payload CarveBeginPayload) (*CarveMetadata, error)
	CarveBlock(ctx context.Context, payload CarveBlockPayload) error
	GetCarve(ctx context.Context, id int64) (*CarveMetadata, error)
	ListCarves(ctx context.Context, opt CarveListOptions) ([]*CarveMetadata, error)
	GetBlock(ctx context.Context, carveId, blockId int64) ([]byte, error)
}

type CarveMetadata struct {
	// ID is the DB auto-increment ID for the carve.
	ID int64 `json:"id" db:"id"`
	// CreatedAt is the creation timestamp.
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	// HostId is the ID of the host that initiated the carve.
	HostId uint `json:"host_id" db:"host_id"`
	// Name is the human readable name for this carve.
	Name string `json:"name" db:"name"`
	// BlockCount is the number of blocks in the carve.
	BlockCount int64 `json:"block_count" db:"block_count"`
	// BlcokSize is the size of each block in the carve.
	BlockSize int64 `json:"block_size" db:"block_size"`
	// CarveSize is the total size of the carve.
	CarveSize int64 `json:"carve_size" db:"carve_size"`
	// CarveId is a uuid generated by osquery for the carve.
	CarveId string `json:"carve_id" db:"carve_id"`
	// RequestId is the name of the query that kicked off this carve.
	RequestId string `json:"request_id" db:"request_id"`
	// SessionId is generated by Fleet and used by osquery to identify blocks.
	SessionId string `json:"session_id" db:"session_id"`
	// Expired is whether the carve has "expired" (data has been purged).
	Expired bool `json:"expired" db:"expired"`

	// MaxBlock is the highest block number currently stored for this carve.
	// This value is not stored directly, but generated from the carve_blocks
	// table.
	MaxBlock int64 `json:"max_block" db:"max_block"`
}

func (c CarveMetadata) AuthzType() string {
	return "carve"
}

func (c *CarveMetadata) BlocksComplete() bool {
	return c.MaxBlock == c.BlockCount-1
}

type CarveListOptions struct {
	ListOptions

	// Expired determines whether to include expired carves.
	Expired bool
}

type CarveBeginPayload struct {
	BlockCount int64
	BlockSize  int64
	CarveSize  int64
	CarveId    string
	RequestId  string
}

type CarveBlockPayload struct {
	SessionId string
	RequestId string
	BlockId   int64
	Data      []byte
}
