import { RepositoryInterface, SNSFacade } from '@gustavoadolfo/minhoteca-adapter-layer';
import {
  UseCaseInterface,
  PageDataType,
  LogService,
  EmprestimoDTO,
} from '@gustavoadolfo/minhoteca-core-layer';
import { APIGatewayEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import { createResult } from '../util';

export class CriarEmprestimoUseCase implements UseCaseInterface {
  private _tabelaEmprestimoUsuario: string;
  private _tabelaEmprestimoLivros: string;
  private _publisherAlertas: string | undefined;
  private logService = new LogService('CriarEmprestimoUseCase');

  constructor(private _repository: RepositoryInterface) {
    this._tabelaEmprestimoUsuario = process.env.TABELA_EMPRESTIMO_USUARIO ?? 'EmprestimoUsuario';
    this._tabelaEmprestimoLivros = process.env.TABELA_EMPRESTIMO_LIVROS ?? 'EmprestimoLivros';
    this._publisherAlertas = process.env.SNS_ALERTAS;
  }

  async execute(data: APIGatewayEvent, idExecucao: string): Promise<PageDataType> {
    this.logService.info(
      'Início a execução do caso de uso CriarEmprestimoUseCase',
      { label: 'CriarEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
      { data }
    );
    try {
      const body = JSON.parse(data.body ?? '{}') as Record<string, unknown>;
      const emprestimo = {
        ...body,
        toJSONString: () => JSON.stringify(body),
      } as EmprestimoDTO;
      this.logService.info(
        'Dados recebidos para gravação',
        { label: 'CriarEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
        { emprestimo }
      );

      await this._repository.saveData(
        this._tabelaEmprestimoUsuario,
        JSON.parse(emprestimo.toJSONString())
      );
      this.logService.info(
        'Empréstimo de usuário gravado com sucesso',
        { label: 'CriarEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
        { emprestimo }
      );
      await this._repository.saveData(
        this._tabelaEmprestimoLivros,
        JSON.parse(emprestimo.toJSONString())
      );
      this.logService.info(
        'Empréstimo de livro gravado com sucesso',
        { label: 'CriarEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
        { emprestimo }
      );

      try {
        if (this._publisherAlertas) {
          const snsFacade = new SNSFacade(idExecucao);
          await snsFacade.sendMessage(
            this._publisherAlertas,
            JSON.stringify({ message: `Novo empréstimo criado: ${emprestimo}` })
          );
          this.logService.info(
            'Alerta de novo empréstimo enviado com sucesso',
            { label: 'CriarEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
            { emprestimo }
          );
        }
      } catch (error) {
        this.logService.error(
          'Erro ao enviar alerta de novo empréstimo:',
          { label: 'CriarEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
          error as Error,
          { emprestimo }
        );
      }

      return createResult([emprestimo], 201, 'Empréstimo criado com sucesso');
    } catch (error) {
      this.logService.error(
        'Erro ao criar empréstimo:',
        { label: 'CriarEmprestimoUseCase', ...(idExecucao && { logId: idExecucao }) },
        error as Error,
        { data }
      );
      throw new Error('Falha ao criar empréstimo.');
    }
  }
}
