import { ObterLivroUseCase } from '../../../layer/nodejs/src/livro/obter-livro';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { LivroDTO, LogService } from '@gustavoadolfo/minhoteca-core-layer';
import { APIGatewayEvent } from 'aws-lambda';

// Mock parcial do core-layer
jest.mock('@gustavoadolfo/minhoteca-core-layer', () => {
  const actual = jest.requireActual('@gustavoadolfo/minhoteca-core-layer');
  return {
    ...actual,
    LogService: jest.fn().mockImplementation(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    })),
  };
});

describe('ObterLivroUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;
  const idExecucao = 'test-execution-id';

  const livroMockData = {
    id: 'livro-123',
    titulo: 'Livro de Teste',
    autorId: 'autor-456',
    isbn: '1234567890123',
    imagemCapaUrl: 'http://example.com/capa.jpg',
  };

  const autorMockData = {
    id: 'autor-456',
    nome: 'Autor de Teste',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    repoMock = {
      saveData: jest.fn(),
      getAll: jest.fn(),
      getData: jest.fn(),
      queryData: jest.fn(),
      updateByMinhotecaId: jest.fn(),
      deleteByMinhotecaId: jest.fn(),
      removeData: jest.fn(),
      findByMinhotecaId: jest.fn(),
    } as jest.Mocked<RepositoryInterface>;
  });

  const createEvent = (
    pathParameters: Record<string, string> | null = null,
    queryStringParameters: Record<string, string> | null = null
  ): APIGatewayEvent =>
    ({
      pathParameters,
      queryStringParameters,
    }) as unknown as APIGatewayEvent;

  const getLogServiceMock = (method: 'info' | 'warn' | 'error'): jest.Mock => {
    const logServiceInstance = (LogService as unknown as jest.Mock).mock.results.at(-1)?.value;
    if (!logServiceInstance) {
      throw new Error('LogService mock não foi inicializado.');
    }
    return logServiceInstance[method];
  };

  it('deve obter um livro e seu autor com sucesso', async () => {
    repoMock.findByMinhotecaId
      .mockResolvedValueOnce({ data: livroMockData } as ResultType)
      .mockResolvedValueOnce({ data: autorMockData } as ResultType);

    const useCase = new ObterLivroUseCase(repoMock, idExecucao);
    const event = createEvent({ id: 'livro-123' });

    const result = await useCase.execute(event);

    expect(repoMock.findByMinhotecaId).toHaveBeenCalledWith('Livros', 'livro-123');
    expect(repoMock.findByMinhotecaId).toHaveBeenCalledWith('Autores', 'autor-456');
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Livro obtido com sucesso.');
    expect(result.PageData).toHaveLength(1);
    const livroResult = result.PageData?.[0] as LivroDTO;
    expect(livroResult).toHaveProperty('titulo', 'Livro de Teste');
    expect(livroResult).toHaveProperty('autor');
    expect(livroResult?.autor).toHaveProperty('nome', 'Autor de Teste');
  });

  it('deve obter um livro mesmo que o autor não seja encontrado', async () => {
    repoMock.findByMinhotecaId
      .mockResolvedValueOnce({ data: livroMockData } as ResultType)
      .mockResolvedValueOnce({ data: null } as ResultType); // Autor não encontrado

    const useCase = new ObterLivroUseCase(repoMock, idExecucao);
    const event = createEvent({ id: 'livro-123' });

    const result = await useCase.execute(event);

    expect(repoMock.findByMinhotecaId).toHaveBeenCalledWith('Livros', 'livro-123');
    expect(repoMock.findByMinhotecaId).toHaveBeenCalledWith('Autores', 'autor-456');
    expect(result.Code).toBe(200);
    const livroResult = result.PageData?.[0] as LivroDTO;
    expect(livroResult).toBeDefined();
    expect(livroResult).toHaveProperty('autor', undefined);
  });

  it('deve retornar 404 quando o livro não for encontrado', async () => {
    repoMock.findByMinhotecaId.mockResolvedValueOnce({ data: null } as ResultType);

    const useCase = new ObterLivroUseCase(repoMock, idExecucao);
    const event = createEvent({ id: 'nao-existe' });

    const result = await useCase.execute(event);

    expect(result.Code).toBe(404);
    expect(result.Message).toBe('Livro não encontrado.');
    expect(getLogServiceMock('warn')).toHaveBeenCalledWith(
      'Livro não encontrado.',
      expect.any(Object)
    );
  });

  it('deve lançar erro quando o ID do livro não for informado', async () => {
    const useCase = new ObterLivroUseCase(repoMock, idExecucao);
    const event = createEvent(null, null);

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao obter livro.');
    expect(getLogServiceMock('error')).toHaveBeenCalledWith(
      'Falha ao obter livro:',
      expect.any(Object),
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('deve usar o ID do queryStringParameters como fallback', async () => {
    repoMock.findByMinhotecaId.mockResolvedValueOnce({ data: livroMockData } as ResultType);
    repoMock.findByMinhotecaId.mockResolvedValueOnce({ data: autorMockData } as ResultType);

    const useCase = new ObterLivroUseCase(repoMock, idExecucao);
    const event = createEvent(null, { id: 'livro-qs-123' });

    await useCase.execute(event);

    expect(repoMock.findByMinhotecaId).toHaveBeenCalledWith('Livros', 'livro-qs-123');
  });

  it('deve usar os nomes das tabelas das variáveis de ambiente', async () => {
    process.env.TABELA_LIVROS = 'Livros_Test';
    process.env.TABELA_AUTORES = 'Autores_Test';

    repoMock.findByMinhotecaId
      .mockResolvedValueOnce({ data: livroMockData } as ResultType)
      .mockResolvedValueOnce({ data: autorMockData } as ResultType);

    const useCase = new ObterLivroUseCase(repoMock, idExecucao);
    const event = createEvent({ id: 'livro-123' });

    await useCase.execute(event);

    expect(repoMock.findByMinhotecaId).toHaveBeenCalledWith('Livros_Test', 'livro-123');
    expect(repoMock.findByMinhotecaId).toHaveBeenCalledWith('Autores_Test', 'autor-456');

    // Limpa as variáveis de ambiente
    delete process.env.TABELA_LIVROS;
    delete process.env.TABELA_AUTORES;
  });

  it('deve capturar e relançar erro quando o repositório falhar', async () => {
    repoMock.findByMinhotecaId.mockRejectedValueOnce(new Error('Falha no DB'));

    const useCase = new ObterLivroUseCase(repoMock, idExecucao);
    const event = createEvent({ id: 'livro-123' });

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao obter livro.');
    expect(getLogServiceMock('error')).toHaveBeenCalledWith(
      'Falha ao obter livro:',
      expect.any(Object),
      expect.any(Error),
      expect.any(Object)
    );
  });
});
